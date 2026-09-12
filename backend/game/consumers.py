import asyncio
import json
import time
import uuid

from channels.generic.websocket import AsyncWebsocketConsumer

QUESTION_BANK = [
    {
        "question": "What is the capital of France?",
        "options": ["Paris", "London", "Berlin", "Madrid"],
        "answer": "Paris",
    },
    {
        "question": "Which planet is known as the Red Planet?",
        "options": ["Venus", "Mars", "Jupiter", "Saturn"],
        "answer": "Mars",
    },
]
TOTAL_ROUNDS = 10
ROUND_DURATION = 15
MAX_POINTS = 1000
MIN_POINTS = 100
GRACE_PERIOD = 30   # seconds a disconnected player's spot is held before removal


class RoomConsumer(AsyncWebsocketConsumer):
    rooms = {}

    @staticmethod
    def create_room_state():
        return {
          "players": {},
          "scores": {},
          "answered": set(),
          "host": None,
          "connections": {},
          "channel_to_player": {},
          "pending_removal": {},
          "question_index": -1,
          "round_number": 0,
          "game_over": False,
          "round_ends_at": 0.0,
          "round_duration": ROUND_DURATION,
          "round_open": False,
          "round_task": None,
        }

    async def connect(self):
        self.room_code = self.scope["url_route"]["kwargs"]["room_code"]
        self.room_group_name = f"room_{self.room_code}"

        if self.room_code not in self.rooms:
            self.rooms[self.room_code] = self.create_room_state()
            

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()
        # Note: no player identity yet — that's established by the "join" message,
        # since that's the first point we have a nickname and (maybe) a returning player_id.

    async def disconnect(self, close_code):
        room = self.rooms.get(self.room_code)
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

        if not room:
            return

        player_id = room["channel_to_player"].pop(self.channel_name, None)
        if player_id is None:
            return  # they disconnected before ever completing a join

        # Mark offline rather than deleting — this is the whole point of the grace period.
        room["connections"][player_id] = None

        task = asyncio.create_task(self._remove_after_grace(self.room_code, player_id))
        room["pending_removal"][player_id] = task

    async def _remove_after_grace(self, room_code, player_id):
        await asyncio.sleep(GRACE_PERIOD)

        room = self.rooms.get(room_code)
        if not room:
            return

        # If they reconnected, connections[player_id] will be a real channel_name again — bail.
        if room["connections"].get(player_id) is not None:
            return

        nickname = room["players"].pop(player_id, None)
        room["scores"].pop(player_id, None)
        room["answered"].discard(player_id)
        room["connections"].pop(player_id, None)
        room["pending_removal"].pop(player_id, None)

        if room["host"] == player_id:
            room["host"] = next(iter(room["players"]), None)

        if not room["players"]:
            if room["round_task"]:
                room["round_task"].cancel()
            del self.rooms[room_code]
            return

        await self.channel_layer.group_send(
            f"room_{room_code}",
            {
                "type": "player_list",
                "players": self._player_list_payload(room),
                "nickname": nickname,
            },
        )

    def _player_list_payload(self, room):
       return [
          {
             "player_id": pid,
             "nickname": nickname,
             "online": room["connections"].get(pid) is not None,
             "is_host": pid == room["host"],
          }
          for pid, nickname in room["players"].items()
        ]

    async def receive(self, text_data):
        data = json.loads(text_data)
        message_type = data.get("type")
        room = self.rooms.get(self.room_code)
        if not room:
            return

        if message_type == "join":
            await self._handle_join(room, data)
            return

        # Every other message type requires an established identity first.
        player_id = room["channel_to_player"].get(self.channel_name)
        if player_id is None:
            await self._send_error("You must join before sending this.")
            return

        if message_type == "start_round":
            await self._handle_start_round(room, player_id)
        elif message_type == "answer":
            await self._handle_answer(room, player_id, data)

    async def _handle_join(self, room, data):
        nickname = data.get("nickname", "Anonymous")
        requested_id = data.get("player_id")

        is_reconnect = requested_id in room["players"]

        if is_reconnect:
            player_id = requested_id
            # Cancel the pending grace-period removal — they made it back in time.
            pending = room["pending_removal"].pop(player_id, None)
            if pending:
                pending.cancel()
        else:
            player_id = str(uuid.uuid4())
            room["players"][player_id] = nickname
            room["scores"].setdefault(player_id, 0)
            if room["host"] is None:
                room["host"] = player_id

        room["connections"][player_id] = self.channel_name
        room["channel_to_player"][self.channel_name] = player_id

        # Tell this client its identity so it can send it back on a future reconnect.
        await self.send(text_data=json.dumps({
            "type": "joined",
            "player_id": player_id,
            "reconnected": is_reconnect,
        }))

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "player_list",
                "players": self._player_list_payload(room),
                "nickname": room["players"][player_id],
            },
        )

        # Catch a reconnecting player up on an in-progress round.
        if is_reconnect and room["round_open"]:
            question = QUESTION_BANK[room["question_index"]]
            await self.send(text_data=json.dumps({
                "type": "question_start",
                "question": question["question"],
                "options": question["options"],
                "duration": room["round_duration"],
                "ends_at": room["round_ends_at"],
                "already_answered": player_id in room["answered"],
            }))

    async def _handle_start_round(self, room, player_id):
        if player_id != room["host"]:
            return
        if room["game_over"]:
            return  # NEW — no more rounds once the game has ended

        room["question_index"] = (room["question_index"] + 1) % len(QUESTION_BANK)
        room["round_number"] += 1   # NEW
        question = QUESTION_BANK[room["question_index"]]

        duration = ROUND_DURATION
        ends_at = time.time() + duration

        room["round_ends_at"] = ends_at
        room["round_duration"] = duration
        room["round_open"] = True
        room["answered"] = set()

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "question_start",
                "question": question["question"],
                "options": question["options"],
                "duration": duration,
                "ends_at": ends_at,
                "already_answered": False,
            },
        )

        if room["round_task"]:
            room["round_task"].cancel()
        room["round_task"] = asyncio.create_task(
            self.end_round_after_delay(self.room_code, room["question_index"])
        )

    async def _handle_answer(self, room, player_id, data):
        now = time.time()

        if not room["round_open"] or now >= room["round_ends_at"]:
            await self._send_error("Round is closed.")
            return

        if player_id in room["answered"]:
            await self._send_error("You already answered this round.")
            return

        room["answered"].add(player_id)

        choice = data.get("choice")
        question = QUESTION_BANK[room["question_index"]]
        correct = (choice == question["answer"])

        points = 0
        if correct:
            time_remaining = max(0.0, room["round_ends_at"] - now)
            ratio = time_remaining / room["round_duration"]
            points = max(MIN_POINTS, round(MAX_POINTS * ratio))
            room["scores"][player_id] = room["scores"].get(player_id, 0) + points

        await self.send(text_data=json.dumps({
            "type": "answer_result",
            "correct": correct,
            "points": points,
            "total": room["scores"].get(player_id, 0),
        }))

        await self.channel_layer.group_send(
            self.room_group_name,
            {"type": "player_answered", "nickname": room["players"].get(player_id, "?")},
        )

    async def _send_error(self, msg):
        await self.send(text_data=json.dumps({"type": "error", "message": msg}))

    async def end_round_after_delay(self, room_code, question_index):
        room = self.rooms.get(room_code)
        if not room or room["question_index"] != question_index:
            return

        await asyncio.sleep(room["round_duration"])

        room = self.rooms.get(room_code)
        if not room or room["question_index"] != question_index:
            return

        room["round_open"] = False
        question = QUESTION_BANK[question_index]

        scoreboard = sorted(
           (
              {"nickname": nickname, "score": room["scores"].get(pid, 0)}
              for pid, nickname in room["players"].items()
            ),
            key=lambda p: p["score"],
            reverse=True,
        )

        game_over = room["round_number"] >= TOTAL_ROUNDS   # NEW
        room["game_over"] = game_over                       # NEW

        await self.channel_layer.group_send(
           f"room_{room_code}",
           {
              "type": "round_end",
              "answer": question["answer"],
              "scoreboard": scoreboard,
              "game_over": game_over,              # NEW
              "round_number": room["round_number"], # NEW
              "total_rounds": TOTAL_ROUNDS,          # NEW
            },
        )

    # ---------------- group event handlers ----------------

    async def player_list(self, event):
        await self.send(text_data=json.dumps({
            "type": "player_list",
            "players": event["players"],
            "nickname": event["nickname"],
        }))

    async def question_start(self, event):
        await self.send(text_data=json.dumps({
            "type": "question_start",
            "question": event["question"],
            "options": event["options"],
            "duration": event["duration"],
            "ends_at": event["ends_at"],
        }))

    async def player_answered(self, event):
        await self.send(text_data=json.dumps({
            "type": "player_answered",
            "nickname": event["nickname"],
        }))

    async def round_end(self, event):
        await self.send(text_data=json.dumps({
            "type": "round_end",
            "answer": event["answer"],
            "scoreboard": event["scoreboard"],
            "game_over": event["game_over"],
            "round_number": event["round_number"],
            "total_rounds": event["total_rounds"],
        }))
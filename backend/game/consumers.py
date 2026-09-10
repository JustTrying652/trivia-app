import asyncio
import json
import time

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
ROUND_DURATION = 60       # seconds — default duration for a round
MAX_POINTS = 1000         # points for an instant correct answer
MIN_POINTS = 100          # floor for a slow-but-correct answer


class RoomConsumer(AsyncWebsocketConsumer):
    rooms = {}

    async def connect(self):
        self.room_code = self.scope["url_route"]["kwargs"]["room_code"]
        self.room_group_name = f"room_{self.room_code}"

        if self.room_code not in self.rooms:
            self.rooms[self.room_code] = {
                "players": {},                  # channel_name -> nickname
                "scores": {},                   # channel_name -> total score
                "host": None,                   # channel_name of whoever can start rounds
                "question_index": -1,
                "round_ends_at": 0.0,           # server timestamp when the round ends
                "round_duration": ROUND_DURATION,  # authoritative duration for the active round
                "round_open": False,            # is a round currently accepting answers?
                "answered": set(),              # channel_names that already answered this round
                "round_task": None,             # asyncio task counting down the current round
            }

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name,
        )
        await self.accept()

    async def disconnect(self, close_code):
        room = self.rooms.get(self.room_code)
        if not room:
            await self.channel_layer.group_discard(
                self.room_group_name, self.channel_name
            )
            return

        removed_nickname = room["players"].pop(self.channel_name, None)
        room["scores"].pop(self.channel_name, None)
        room["answered"].discard(self.channel_name)

        if room["host"] == self.channel_name:
            room["host"] = next(iter(room["players"]), None)

        if not room["players"]:
            if room["round_task"]:
                room["round_task"].cancel()
            del self.rooms[self.room_code]
        else:
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "player_list",
                    "players": list(room["players"].values()),
                    "nickname": removed_nickname,
                },
            )

        await self.channel_layer.group_discard(
            self.room_group_name, self.channel_name
        )

    async def receive(self, text_data):
        data = json.loads(text_data)
        message_type = data.get("type")
        room = self.rooms.get(self.room_code)
        if not room:
            return

        if message_type == "join":
            await self._handle_join(room, data)

        elif message_type == "start_round":
            await self._handle_start_round(room)

        elif message_type == "answer":
            await self._handle_answer(room, data)

    # ---------------- handlers ----------------

    async def _handle_join(self, room, data):
        nickname = data.get("nickname", "Anonymous")
        room["players"][self.channel_name] = nickname
        room["scores"].setdefault(self.channel_name, 0)

        if room["host"] is None:
            room["host"] = self.channel_name

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "player_list",
                "players": list(room["players"].values()),
                "nickname": nickname,
            },
        )

    async def _handle_start_round(self, room):
        if self.channel_name != room["host"]:
            return  # only host can start rounds

        room["question_index"] = (room["question_index"] + 1) % len(QUESTION_BANK)
        question = QUESTION_BANK[room["question_index"]]

        # This is the ONE place duration is decided. Everyone else reads it from the room.
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
            },
        )

        if room["round_task"]:
            room["round_task"].cancel()
        room["round_task"] = asyncio.create_task(
            self.end_round_after_delay(self.room_code, room["question_index"])
        )

    async def _handle_answer(self, room, data):
        now = time.time()

        # 1) Round must be open and not past its deadline
        if not room["round_open"] or now >= room["round_ends_at"]:
            await self._send_error("Round is closed.")
            return

        # 2) One answer per player per round
        if self.channel_name in room["answered"]:
            await self._send_error("You already answered this round.")
            return

        # Lock in immediately so a duplicate can't slip through in the same tick
        room["answered"].add(self.channel_name)

        choice = data.get("choice")
        question = QUESTION_BANK[room["question_index"]]
        correct = (choice == question["answer"])

        points = 0
        if correct:
            time_remaining = max(0.0, room["round_ends_at"] - now)
            ratio = time_remaining / room["round_duration"]
            points = max(MIN_POINTS, round(MAX_POINTS * ratio))
            room["scores"][self.channel_name] = (
                room["scores"].get(self.channel_name, 0) + points
            )

        # Acknowledge to the answering player only
        await self.send(text_data=json.dumps({
            "type": "answer_result",
            "correct": correct,
            "points": points,
            "total": room["scores"].get(self.channel_name, 0),
        }))

        # Broadcast who answered (optional — for a "locked in" indicator)
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "player_answered",
                "nickname": room["players"].get(self.channel_name, "?"),
            },
        )

    async def _send_error(self, msg):
        await self.send(text_data=json.dumps({"type": "error", "message": msg}))

    async def end_round_after_delay(self, room_code, question_index):
        # Read the room BEFORE sleeping so we bail early if it's already gone
        room = self.rooms.get(room_code)
        if not room or room["question_index"] != question_index:
            return

        await asyncio.sleep(room["round_duration"])

        # Re-check after sleeping — a new round may have started (or the room vanished)
        room = self.rooms.get(room_code)
        if not room or room["question_index"] != question_index:
            return  # room gone, or a new round already started

        room["round_open"] = False
        question = QUESTION_BANK[question_index]

        # Build the scoreboard
        scoreboard = sorted(
            (
                {"nickname": room["players"].get(ch, "?"), "score": score}
                for ch, score in room["scores"].items()
                if ch in room["players"]
            ),
            key=lambda p: p["score"],
            reverse=True,
        )

        await self.channel_layer.group_send(
            f"room_{room_code}",
            {
                "type": "round_end",
                "answer": question["answer"],
                "scoreboard": scoreboard,
            },
        )

    # ---------------- group event handlers (server -> client forwarding) ----------------

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
        }))
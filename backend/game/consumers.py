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
ROUND_DURATION = 15  # seconds


class RoomConsumer(AsyncWebsocketConsumer):
    rooms = {}

    async def connect(self):
        self.room_code = self.scope["url_route"]["kwargs"]["room_code"]
        self.room_group_name = f"room_{self.room_code}"

        if self.room_code not in self.rooms:
            self.rooms[self.room_code] = {
                "players": {},        # channel_name -> nickname
                "host": None,         # channel_name of whoever can start rounds
                "question_index": -1,
                "round_task": None,   # asyncio task counting down the current round
            }

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        room = self.rooms.get(self.room_code)

        if room:
            removed_nickname = room["players"].pop(self.channel_name, None)

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
                    }
                )

        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        data = json.loads(text_data)
        message_type = data.get("type")
        room = self.rooms.get(self.room_code)

        if message_type == "join":
            nickname = data.get("nickname", "Anonymous")
            room["players"][self.channel_name] = nickname

            if room["host"] is None:
                room["host"] = self.channel_name

            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "player_list",
                    "players": list(room["players"].values()),
                    "nickname": nickname,
                }
            )

        elif message_type == "start_round":
            if self.channel_name != room["host"]:
                return  # only host can start rounds

            room["question_index"] = (room["question_index"] + 1) % len(QUESTION_BANK)
            question = QUESTION_BANK[room["question_index"]]
            duration = ROUND_DURATION
            ends_at = time.time() + duration

            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "question_start",
                    "question": question["question"],
                    "options": question["options"],
                    "duration": duration,
                    "ends_at": ends_at,
                }
            )

            if room["round_task"]:
                room["round_task"].cancel()
            room["round_task"] = asyncio.create_task(
                self.end_round_after_delay(self.room_code, room["question_index"], duration)
            )

    async def end_round_after_delay(self, room_code, question_index, duration):
        await asyncio.sleep(duration)

        room = self.rooms.get(room_code)
        if not room or room["question_index"] != question_index:
            return  # room gone, or a new round already started

        question = QUESTION_BANK[question_index]
        await self.channel_layer.group_send(
            f"room_{room_code}",
            {"type": "round_end", "answer": question["answer"]},
        )

    # --- group event handlers (server -> client forwarding) ---

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

    async def round_end(self, event):
        await self.send(text_data=json.dumps({
            "type": "round_end",
            "answer": event["answer"],
        }))
import json
from channels.generic.websocket import AsyncWebsocketConsumer


class RoomConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_code = self.scope["url_route"]["kwargs"]["room_code"]
        self.room_group_name = f"room_{self.room_code}"

        # Join the room group (this is the Redis-backed broadcast group)
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        # Leave the room group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    # Called when a message arrives FROM the client (browser -> server)
    async def receive(self, text_data):
        data = json.loads(text_data)
        message_type = data.get("type")

        if message_type == "join":
            nickname = data.get("nickname", "Anonymous")

            # Broadcast to everyone in the room, including sender
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "player_joined",   # maps to method name below
                    "nickname": nickname,
                }
            )

    # Called when a message arrives FROM the group (server -> all clients)
    async def player_joined(self, event):
        # Forward it out over this specific socket connection
        await self.send(text_data=json.dumps({
            "type": "player_joined",
            "nickname": event["nickname"],
        }))
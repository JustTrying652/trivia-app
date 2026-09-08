import json
from channels.generic.websocket import AsyncWebsocketConsumer


class RoomConsumer(AsyncWebsocketConsumer):
    rooms = {}

    async def connect(self):
        self.room_code = self.scope["url_route"]["kwargs"]["room_code"]
        self.room_group_name = f"room_{self.room_code}"

        if self.room_code not in self.rooms:    
            self.rooms[self.room_code] = {}

        # Join the room group (this is the Redis-backed broadcast group)
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        if self.room_code in self.rooms:
            removed_nickname = self.rooms[self.room_code].pop(self.channel_name, None)

            if not self.rooms[self.room_code]:
                del self.rooms[self.room_code]
            else:
               await self.channel_layer.group_send(
                  self.room_group_name,
                 {
                    "type": "player_list",
                    "players": list(self.rooms[self.room_code].values()),
                    "nickname": removed_nickname,
                 }
            )

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

            self.rooms[self.room_code][self.channel_name] = nickname

            # Broadcast to everyone in the room, including sender
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "player_list", 
                    "players": list(self.rooms[self.room_code].values()),
                    "nickname": nickname,
                }
            )

    # Called when a message arrives FROM the group (server -> all clients)
    async def player_list(self, event):
        # Forward it out over this specific socket connection
        await self.send(text_data=json.dumps({
            "type": "player_list",
            "players": event["players"],    
            "nickname": event["nickname"],
        }))
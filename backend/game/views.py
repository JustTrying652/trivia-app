import random
import string

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .consumers import RoomConsumer
from .trivia_api import fetch_questions

def _generate_room_code(length=6):
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=length))


@csrf_exempt
@require_http_methods(["POST"])
def create_room(request):
    code = _generate_room_code()
    while code in RoomConsumer.rooms:
        code = _generate_room_code()

    questions = fetch_questions(amount=10)
    RoomConsumer.rooms[code] = RoomConsumer.create_room_state(questions=questions)
    return JsonResponse({"room_code": code})

@require_http_methods(["GET"])
def room_status(request, room_code):
    room = RoomConsumer.rooms.get(room_code)
    if not room:
        return JsonResponse({"exists": False}, status=404)

    return JsonResponse({
        "exists": True,
        "player_count": len(room["players"]),
        "round_open": room["round_open"],
    })
import html
import random

import requests

FALLBACK_QUESTIONS = [
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


def fetch_questions(amount=10):
    """Fetch `amount` multiple-choice questions from Open Trivia DB.
    Falls back to a small local bank if the API is unreachable or errors,
    so a flaky network never breaks room creation."""
    try:
        response = requests.get(
            "https://opentdb.com/api.php",
            params={"amount": amount, "type": "multiple"},
            timeout=5,
        )
        response.raise_for_status()
        data = response.json()

        if data.get("response_code") != 0 or not data.get("results"):
            return FALLBACK_QUESTIONS

        questions = []
        for item in data["results"]:
            question_text = html.unescape(item["question"])
            correct = html.unescape(item["correct_answer"])
            incorrect = [html.unescape(a) for a in item["incorrect_answers"]]

            options = incorrect + [correct]
            random.shuffle(options)  # otherwise the correct answer is always last

            questions.append({
                "question": question_text,
                "options": options,
                "answer": correct,
            })

        return questions

    except (requests.RequestException, ValueError, KeyError):
        return FALLBACK_QUESTIONS
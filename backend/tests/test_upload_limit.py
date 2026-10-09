import asyncio

from app.core.upload_limit import VerificationUploadSizeLimitMiddleware


def test_verification_upload_body_limit_returns_413_for_chunked_oversize():
    sent_messages = []
    receive_messages = [
        {
            "type": "http.request",
            "body": b"1234",
            "more_body": True,
        }
    ]

    async def app(scope, receive, send):
        await receive()

    async def receive():
        return receive_messages.pop(0)

    async def send(message):
        sent_messages.append(message)

    async def exercise():
        middleware = VerificationUploadSizeLimitMiddleware(app)
        middleware.max_request_bytes = 3
        await middleware(
            {
                "type": "http",
                "method": "POST",
                "path": "/owner/verification",
                "headers": [],
            },
            receive,
            send,
        )

    asyncio.run(exercise())

    assert sent_messages[0]["status"] == 413
    assert b"26 MB" in sent_messages[1]["body"]


def test_verification_upload_body_limit_does_not_affect_other_paths():
    sent_messages = []
    received = []

    async def app(scope, receive, send):
        received.append(await receive())
        await send({"type": "http.response.start", "status": 200, "headers": []})
        await send({"type": "http.response.body", "body": b"ok"})

    async def receive():
        return {"type": "http.request", "body": b"large", "more_body": False}

    async def send(message):
        sent_messages.append(message)

    async def exercise():
        middleware = VerificationUploadSizeLimitMiddleware(app)
        middleware.max_request_bytes = 3
        await middleware(
            {
                "type": "http",
                "method": "POST",
                "path": "/auth/register",
                "headers": [],
            },
            receive,
            send,
        )

    asyncio.run(exercise())

    assert received[0]["body"] == b"large"
    assert sent_messages[0]["status"] == 200

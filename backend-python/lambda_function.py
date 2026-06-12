
"""
AWS Lambda entry point.

Uses Mangum to wrap the Flask WSGI app (via an ASGI adapter) for
Lambda Function URL (HTTP API v2 payload format).

Lambda environment variables required:
  DSQL_ENDPOINT  = ezt2bkam5s4kjre73r25easkcu.dsql.us-east-1.on.aws
  DSQL_REGION    = us-east-1

Handler setting in Lambda console:
  lambda_function.lambda_handler       <- main HTTP handler
  lambda_function.alert_handler        <- EventBridge scheduled rule (every 1 min)
"""

import asyncio

# Python 3.14 removed the implicit auto-creation of an event loop in
# asyncio.get_event_loop() when called from the main thread with no
# running loop. Mangum 0.19.0 relies on that old behavior, so we create
# and set one explicitly at import time.
try:
    asyncio.get_event_loop()
except RuntimeError:
    asyncio.set_event_loop(asyncio.new_event_loop())

from mangum import Mangum
from asgiref.wsgi import WsgiToAsgi
from app import app

# -- Main HTTP handler ----------------------------------------------------
# Flask is a WSGI app. Mangum 0.19 expects an ASGI app, so wrap Flask
# with asgiref's WsgiToAsgi adapter before passing it to Mangum.
_asgi_app = WsgiToAsgi(app)
_mangum = Mangum(_asgi_app, lifespan="off")


def lambda_handler(event, context):
    """Handle all incoming HTTP requests via Lambda Function URL."""
    # Ensure an event loop exists in this execution context too
    # (Lambda may reuse threads across invocations).
    try:
        asyncio.get_event_loop()
    except RuntimeError:
        asyncio.set_event_loop(asyncio.new_event_loop())

    return _mangum(event, context)


# -- Alert engine handler ---------------------------------------------------
# Wire an EventBridge scheduled rule (rate: 1 minute) to this handler.
def alert_handler(event, context):
    """Run one pass of the alert engine. Called by EventBridge scheduled rule."""
    from alert_engine import run_alert_check_once
    run_alert_check_once()
    return {"status": "ok"}


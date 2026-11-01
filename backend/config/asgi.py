import os

from dotenv import load_dotenv

load_dotenv()
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")

from django.core.asgi import get_asgi_application

application = get_asgi_application()

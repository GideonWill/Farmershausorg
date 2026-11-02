import os
from django.core.wsgi import get_wsgi_application

# Default to production settings for Vercel deployment if not explicitly set
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.prod")

app = get_wsgi_application()


import os

from celery import Celery
from dotenv import load_dotenv

load_dotenv()
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")

app = Celery("farmershaus")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
app.conf.beat_schedule = {
    "expire-due-order-reservations-every-minute": {
        "task": "apps.orders.tasks.expire_due_order_reservations",
        "schedule": 60.0,
    },
}

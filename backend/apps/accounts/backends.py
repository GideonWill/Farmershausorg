import re

from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend
from django.db.models import Q


class IdentifierBackend(ModelBackend):
    def authenticate(self, request, username=None, password=None, identifier=None, **kwargs):
        identifier = identifier or username
        if not identifier or not password:
            return None

        normalized = re.sub(r"[\s()-]", "", identifier)
        UserModel = get_user_model()
        matches = UserModel._default_manager.filter(
            Q(username__iexact=identifier)
            | Q(email__iexact=identifier)
            | Q(phone=normalized)
        )
        if matches.count() != 1:
            return None
        user = matches.first()
        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None

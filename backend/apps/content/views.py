from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema

from apps.content.models import SiteSettings
from apps.content.serializers import PublicSiteSettingsSerializer


class PublicSiteSettingsView(APIView):
    permission_classes = (AllowAny,)

    @extend_schema(responses=PublicSiteSettingsSerializer)
    def get(self, request):
        settings = SiteSettings.objects.get(pk=1)
        return Response(PublicSiteSettingsSerializer(settings).data)

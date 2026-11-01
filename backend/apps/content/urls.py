from django.urls import path

from apps.content.views import PublicSiteSettingsView


urlpatterns = [
    path("site-settings/", PublicSiteSettingsView.as_view(), name="public-site-settings"),
]

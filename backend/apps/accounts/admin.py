from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import BranchMembership, OTPChallenge, User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    fieldsets = DjangoUserAdmin.fieldsets + (
        ("FarmersHaus profile", {"fields": ("phone", "display_name")}),
    )
    add_fieldsets = DjangoUserAdmin.add_fieldsets + (
        ("FarmersHaus profile", {"fields": ("phone", "display_name")}),
    )
    list_display = ("username", "email", "phone", "is_staff", "is_active")
    search_fields = ("username", "email", "phone", "display_name")


@admin.register(BranchMembership)
class BranchMembershipAdmin(admin.ModelAdmin):
    list_display = ("user", "branch", "role", "is_active")
    list_filter = ("branch", "role", "is_active")
    search_fields = ("user__username", "user__phone", "branch__name")


@admin.register(OTPChallenge)
class OTPChallengeAdmin(admin.ModelAdmin):
    list_display = ("identifier", "expires_at", "attempts", "consumed_at")
    readonly_fields = ("id", "identifier", "code_hash", "expires_at", "attempts", "consumed_at")
    search_fields = ("identifier",)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

from rest_framework.permissions import BasePermission

from apps.accounts.models import BranchMembership


class IsSuperAdmin(BasePermission):
    message = "Super Admin access is required."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)


class HasAnyBranchMembership(BasePermission):
    message = "Active branch staff access is required."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser:
            return True
        return BranchMembership.objects.filter(user=user, is_active=True).exists()


class HasBranchMembership(BasePermission):
    message = "You do not have access to this branch."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser:
            return True

        branch_id = (
            view.kwargs.get("branch_id")
            or view.kwargs.get("branch_pk")
            or request.query_params.get("branch")
        )
        return bool(
            branch_id
            and BranchMembership.objects.filter(
                user=user,
                branch_id=branch_id,
                is_active=True,
            ).exists()
        )


class HasBranchManagerMembership(HasBranchMembership):
    message = "Branch Manager access is required for this branch."

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        if request.user.is_superuser:
            return True
        branch_id = (
            view.kwargs.get("branch_id")
            or view.kwargs.get("branch_pk")
            or request.query_params.get("branch")
        )
        return BranchMembership.objects.filter(
            user=request.user,
            branch_id=branch_id,
            is_active=True,
            role=BranchMembership.Role.MANAGER,
        ).exists()

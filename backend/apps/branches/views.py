import math

from django.shortcuts import get_object_or_404
from rest_framework import generics, serializers, status, viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema

from apps.branches.models import Branch, DeliveryZone
from apps.branches.serializers import (
    BranchSerializer,
    DeliveryZoneSerializer,
    NearestBranchResponseSerializer,
)
from apps.accounts.models import BranchMembership
from apps.common.permissions import HasAnyBranchMembership


class PublicBranchViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = (AllowAny,)
    serializer_class = BranchSerializer
    queryset = Branch.objects.filter(is_active=True)
    lookup_field = "slug"


class NearestBranchQuerySerializer(serializers.Serializer):
    latitude = serializers.DecimalField(max_digits=9, decimal_places=6, min_value=-90, max_value=90)
    longitude = serializers.DecimalField(max_digits=9, decimal_places=6, min_value=-180, max_value=180)


class NearestBranchView(APIView):
    permission_classes = (AllowAny,)

    @extend_schema(
        parameters=[
            OpenApiParameter("latitude", OpenApiTypes.DECIMAL, OpenApiParameter.QUERY, required=True),
            OpenApiParameter("longitude", OpenApiTypes.DECIMAL, OpenApiParameter.QUERY, required=True),
        ],
        responses={200: NearestBranchResponseSerializer, 404: OpenApiResponse(description="No branch location is configured.")},
    )
    def get(self, request):
        query = NearestBranchQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        latitude = float(query.validated_data["latitude"])
        longitude = float(query.validated_data["longitude"])
        branches = Branch.objects.filter(
            is_active=True,
            latitude__isnull=False,
            longitude__isnull=False,
        )
        nearest = min(
            branches,
            key=lambda branch: self.distance_km(
                latitude, longitude, float(branch.latitude), float(branch.longitude)
            ),
            default=None,
        )
        if nearest is None:
            return Response(
                {"detail": "No active branch has location coordinates configured."},
                status=status.HTTP_404_NOT_FOUND,
            )
        distance = self.distance_km(
            latitude, longitude, float(nearest.latitude), float(nearest.longitude)
        )
        from apps.branches.serializers import BranchSerializer

        return Response(
            {
                "branch": BranchSerializer(nearest).data,
                "distance_km": round(distance, 2),
            }
        )

    @staticmethod
    def distance_km(lat1, lon1, lat2, lon2):
        radius_km = 6371.0088
        lat_delta = math.radians(lat2 - lat1)
        lon_delta = math.radians(lon2 - lon1)
        haversine = (
            math.sin(lat_delta / 2) ** 2
            + math.cos(math.radians(lat1))
            * math.cos(math.radians(lat2))
            * math.sin(lon_delta / 2) ** 2
        )
        return 2 * radius_km * math.asin(math.sqrt(haversine))


class BranchDeliveryZoneListView(generics.ListAPIView):
    permission_classes = (AllowAny,)
    serializer_class = DeliveryZoneSerializer

    def get_queryset(self):
        branch = get_object_or_404(Branch, slug=self.kwargs["branch_slug"], is_active=True)
        return DeliveryZone.objects.filter(branch=branch, is_active=True)


class StaffBranchListView(generics.ListAPIView):
    permission_classes = (IsAuthenticated, HasAnyBranchMembership)
    serializer_class = BranchSerializer

    def get_queryset(self):
        branches = Branch.objects.filter(is_active=True)
        if self.request.user.is_superuser:
            return branches
        branch_ids = BranchMembership.objects.filter(
            user=self.request.user,
            is_active=True,
        ).values_list("branch_id", flat=True)
        return branches.filter(id__in=branch_ids)

from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import EmailTokenObtainPairSerializer, RegisterSerializer, UserSerializer


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        user = self.get_queryset().get(pk=response.data["id"])
        refresh = RefreshToken.for_user(user)
        response.data.update(
            {
                "refresh": str(refresh),
                "access": str(refresh.access_token),
            }
        )
        return response

    def get_queryset(self):
        return self.serializer_class.Meta.model.objects.all()


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = EmailTokenObtainPairSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        refresh = RefreshToken.for_user(serializer.validated_data["user"])
        return Response(
            {
                "refresh": str(refresh),
                "access": str(refresh.access_token),
            }
        )


class CurrentUserView(generics.RetrieveAPIView):
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user

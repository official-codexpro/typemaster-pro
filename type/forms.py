from django import forms
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import User

from .models import UserProfile

MAX_PROFILE_IMAGE_SIZE = 2 * 1024 * 1024
MAX_PROFILE_IMAGE_PIXELS = 25_000_000


class CustomUserCreationForm(UserCreationForm):

    email = forms.EmailField(
        required=True,
        widget=forms.EmailInput(attrs={"placeholder": "Enter your email"}),
    )

    class Meta:
        model = User
        fields = ("username", "email", "password1", "password2")

    def clean_email(self):
        email = self.cleaned_data["email"]

        if User.objects.filter(email__iexact=email).exists():
            raise forms.ValidationError("This email is already registered.")

        return email


class UserUpdateForm(forms.ModelForm):

    email = forms.EmailField(required=True)

    class Meta:
        model = User
        fields = ("username", "email")

    def clean_email(self):
        email = self.cleaned_data["email"]

        if (
            User.objects.filter(email__iexact=email)
            .exclude(pk=self.instance.pk)
            .exists()
        ):
            raise forms.ValidationError("This email is already registered.")

        return email


class ProfileUpdateForm(forms.ModelForm):

    class Meta:
        model = UserProfile
        fields = (
            "bio",
            "profile_picture",
            "cover_image",
        )

        widgets = {
            "bio": forms.Textarea(
                attrs={
                    "rows": 4,
                    "placeholder": "Tell us something about yourself...",
                }
            ),
        }

    def clean(self):
        cleaned_data = super().clean()

        for field_name in ("profile_picture", "cover_image"):
            if field_name not in self.files:
                continue

            image = cleaned_data.get(field_name)
            if not image:
                continue

            if image.size > MAX_PROFILE_IMAGE_SIZE:
                self.add_error(
                    field_name,
                    "Choose an image smaller than 2 MB.",
                )
                continue

            dimensions = getattr(image, "image", None)
            if (
                dimensions
                and dimensions.width * dimensions.height > MAX_PROFILE_IMAGE_PIXELS
            ):
                self.add_error(
                    field_name,
                    "Choose an image with fewer than 25 megapixels.",
                )

        return cleaned_data

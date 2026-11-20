import logging

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string

from .models import TestResult

logger = logging.getLogger(__name__)


def send_certificate_award_email(result_id, certificate_url):
    """Email earned silver and gold typing certificates after the result commits."""
    try:
        result = TestResult.objects.select_related("user").get(pk=result_id)
        if result.certificate not in {"silver", "gold"} or not result.user.email:
            return False

        recipient_name = result.user.get_full_name().strip() or result.user.username
        context = {
            "certificate": result,
            "recipient_name": recipient_name,
            "certificate_url": certificate_url,
        }
        subject = f"Your {result.get_certificate_display()} TypeMaster Pro certificate"
        message = EmailMultiAlternatives(
            subject=subject,
            body=render_to_string("emails/certificate_awarded.txt", context),
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[result.user.email],
        )
        message.attach_alternative(
            render_to_string("emails/certificate_awarded.html", context),
            "text/html",
        )
        return message.send(fail_silently=False) == 1
    except Exception:
        logger.exception("Unable to send certificate email for result %s", result_id)
        return False

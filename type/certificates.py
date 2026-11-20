CERTIFICATE_THRESHOLDS = (
    ("gold", 70, 98),
    ("silver", 50, 95),
    ("bronze", 35, 90),
)


def get_certificate_tier(difficulty, wpm, accuracy):
    """Return the earned certificate for an eligible paragraph typing result."""
    if difficulty not in {"easy", "normal", "hard"}:
        return "none"

    for tier, minimum_wpm, minimum_accuracy in CERTIFICATE_THRESHOLDS:
        if wpm >= minimum_wpm and accuracy >= minimum_accuracy:
            return tier

    return "none"

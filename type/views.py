
import random
import re
import json
from django.db.models import Avg, Max, Sum
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import csrf_protect
from nltk.corpus import brown

from django.shortcuts import render, redirect
from django.http import JsonResponse
from django.contrib.auth import login, logout
from django.contrib.auth.forms import AuthenticationForm
from django.contrib.auth.decorators import login_required

from .forms import (
    CustomUserCreationForm,
    UserUpdateForm,
    ProfileUpdateForm
)

from .models import UserProfile





@ensure_csrf_cookie
def home(request):

    from django.db.models import Avg, Max
    from django.core.paginator import Paginator
    from .models import TestResult

    stats = {
        'total_tests': 0,
        'best_wpm': 0,
        'best_accuracy': 0,
        'average_wpm': 0,
        'average_accuracy': 0,
        'total_characters': 0,
    }

    recent_results = []
    chart_data = []
    page_obj = None
    max_wpm = 0

    if request.user.is_authenticated:

        # All results for dashboard statistics
        results = TestResult.objects.filter(user=request.user)

        summary = results.aggregate(
            best_wpm=Max('wpm'),
            best_accuracy=Max('accuracy'),
            average_wpm=Avg('wpm'),
            average_accuracy=Avg('accuracy'),
            total_characters=Sum('correct_characters'),
        )

        stats = {
            'total_tests': results.count(),
            'best_wpm': summary['best_wpm'] or 0,
            'best_accuracy': summary['best_accuracy'] or 0,
            'average_wpm': round(summary['average_wpm'] or 0),
            'average_accuracy': round(summary['average_accuracy'] or 0, 1),
            'total_characters': summary['total_characters'] or 0,
        }

        # Filters
        difficulty = request.GET.get('difficulty', '')
        date_from = request.GET.get('date_from', '')
        date_to = request.GET.get('date_to', '')

        filtered_results = results

        if difficulty in ['easy', 'normal', 'hard']:
            filtered_results = filtered_results.filter(
                difficulty=difficulty
            )

        if date_from:
            filtered_results = filtered_results.filter(
                created_at__date__gte=date_from
            )

        if date_to:
            filtered_results = filtered_results.filter(
                created_at__date__lte=date_to
            )

        # Pagination: 5 results per page
        paginator = Paginator(
            filtered_results.order_by('-created_at'),
            5
        )

        page_obj = paginator.get_page(request.GET.get('page'))
        recent_results = page_obj.object_list

        max_wpm = max(
            (result.wpm for result in recent_results),
            default=0
        )

        # Last 5 results for performance chart
        chart_results = list(
            results.order_by('-created_at')[:5]
        )

        chart_results.reverse()

        chart_data = [
            {
                'date': result.created_at.strftime('%d %b'),
                'wpm': result.wpm,
                'accuracy': result.accuracy,
            }
            for result in chart_results
        ]

    return render(request, 'index.html', {
        'stats': stats,
        'recent_results': recent_results,
        'chart_data': chart_data,
        'page_obj': page_obj,
        'max_wpm': max_wpm,
        'selected_difficulty': request.GET.get('difficulty', ''),
        'date_from': request.GET.get('date_from', ''),
        'date_to': request.GET.get('date_to', ''),
    })

def signup(request):

    if request.user.is_authenticated:
        return redirect('home')

    if request.method == 'POST':
        form = CustomUserCreationForm(request.POST)

        if form.is_valid():
            user = form.save()
            UserProfile.objects.get_or_create(user=user)
            login(request, user)

            return redirect('home')

    else:
        form = CustomUserCreationForm()

    return render(request, 'authentication/signup.html', {
        'form': form
    })


def user_login(request):

    if request.user.is_authenticated:
        return redirect('home')

    if request.method == 'POST':
        form = AuthenticationForm(request, data=request.POST)

        if form.is_valid():
            user = form.get_user()
            login(request, user)

            return redirect('home')

    else:
        form = AuthenticationForm()

    return render(request, 'authentication/login.html', {
        'form': form
    })


def user_logout(request):
    logout(request)
    return redirect('home')


@login_required
def user_profile(request):

    profile, created = UserProfile.objects.get_or_create(
        user=request.user
    )

    return render(request, 'profile/profile.html', {
        'profile': profile
    })


@login_required
def edit_profile(request):

    profile, created = UserProfile.objects.get_or_create(
        user=request.user
    )

    if request.method == 'POST':

        user_form = UserUpdateForm(
            request.POST,
            instance=request.user
        )

        profile_form = ProfileUpdateForm(
            request.POST,
            request.FILES,
            instance=profile
        )

        if user_form.is_valid() and profile_form.is_valid():

            user_form.save()
            profile_form.save()

            return redirect('profile')

    else:

        user_form = UserUpdateForm(instance=request.user)
        profile_form = ProfileUpdateForm(instance=profile)

    return render(request, 'profile/edit_profile.html', {
        'user_form': user_form,
        'profile_form': profile_form,
        'profile': profile
    })

@require_POST
@csrf_protect
def save_test_result(request):

    if not request.user.is_authenticated:
        return JsonResponse({
            'success': False,
            'login_required': True,
            'message': 'Please login to save your results.'
        }, status=401)

    try:
        data = json.loads(request.body)

        wpm = int(data.get('wpm', 0))
        accuracy = float(data.get('accuracy', 0))
        correct_characters = int(data.get('correct_characters', 0))
        mistakes = int(data.get('mistakes', 0))
        duration = int(data.get('duration', 0))
        difficulty = data.get('difficulty', 'normal')

        if (
            wpm < 0 or
            not 0 <= accuracy <= 100 or
            correct_characters < 0 or
            mistakes < 0 or
            duration not in [15, 30, 60, 120] or
            difficulty not in ['easy', 'normal', 'hard']
        ):
            return JsonResponse({
                'success': False,
                'message': 'Invalid test result data.'
            }, status=400)

        from .models import TestResult

        result = TestResult.objects.create(
            user=request.user,
            wpm=wpm,
            accuracy=accuracy,
            correct_characters=correct_characters,
            mistakes=mistakes,
            duration=duration,
            difficulty=difficulty
        )

        return JsonResponse({
            'success': True,
            'message': 'Test result saved successfully.',
            'result_id': result.id
        })

    except (ValueError, TypeError, json.JSONDecodeError):
        return JsonResponse({
            'success': False,
            'message': 'Invalid request data.'
        }, status=400)

def generate_passage(request):

    difficulty = request.GET.get('difficulty', 'normal')

    categories = {
        'easy': ['reviews', 'fiction', 'romance'],
        'normal': ['news', 'editorial', 'adventure'],
        'hard': ['learned', 'government', 'belles_lettres'],
    }

    selected_categories = categories.get(
        difficulty, categories['normal']
    )

    sentences = brown.sents(categories=selected_categories)

    valid_sentences = []

    for sentence in sentences:
        words = [
            word for word in sentence
            if re.search(r'[a-zA-Z0-9]', word)
        ]

        if len(words) >= 5:
            valid_sentences.append(words)

    random.shuffle(valid_sentences)

    passage = []
    word_count = 0
    target_words = 40

    for sentence in valid_sentences:
        passage.extend(sentence)
        word_count += len(sentence)

        if word_count >= target_words:
            break

    text = ' '.join(passage)
    text = re.sub(r'\s+([.,!?;:])', r'\1', text)

    return JsonResponse({
        'success': True,
        'difficulty': difficulty,
        'text': text,
        'word_count': len(text.split())
    })

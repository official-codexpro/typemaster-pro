
import random
import re
import json

from django.db.models import Avg, Max, Sum, Count
from django.shortcuts import render, redirect
from django.http import JsonResponse
from django.core.paginator import Paginator
from django.utils.dateparse import parse_date
from django.contrib.auth.models import User

from django.views.decorators.csrf import (
    ensure_csrf_cookie,
    csrf_protect,
)
from django.views.decorators.http import require_POST

from django.contrib.auth import login, logout
from django.contrib.auth.forms import AuthenticationForm
from django.contrib.auth.decorators import login_required

from .forms import (
    CustomUserCreationForm,
    UserUpdateForm,
    ProfileUpdateForm,
)

from .models import UserProfile, TestResult, SpaceShooterResult


# =========================================================
# TYPING CONTENT
# =========================================================

EASY_WORDS = [
    'the', 'and', 'you', 'are', 'this', 'that', 'have',
    'with', 'from', 'your', 'good', 'home', 'work', 'play',
    'book', 'tree', 'water', 'light', 'small', 'happy',
    'learn', 'write', 'read', 'walk', 'talk', 'open',
    'close', 'green', 'white', 'black', 'simple', 'clean',
    'quick', 'slow', 'today', 'every', 'never', 'always',
    'people', 'friend', 'school', 'family', 'computer',
    'keyboard', 'window', 'screen', 'mouse', 'table',
    'apple', 'house', 'music', 'smile', 'dream', 'bread',
    'river', 'cloud', 'morning', 'garden', 'little', 'hello',
]


NORMAL_SENTENCES = [
    'Technology helps people improve their daily work.',
    'Every developer needs time to practice and improve.',
    'Learning new skills can create better opportunities.',
    'A good project requires planning and attention to detail.',
    'Modern computers can process large amounts of information.',
    'Practice makes it easier to understand new concepts.',
    'Building a website requires creativity and patience.',
    'A strong network connects people across the world.',
    'Software development involves testing and problem solving.',
    'Good communication makes teamwork more effective.',
    'The application stores important information in a database.',
    'Developers should write clean and readable code.',
]


NORMAL_MIXED_SENTENCES = [
    'The project has 3 important stages, and each stage needs attention.',
    'A developer can manage 5 tasks without losing focus.',
    'The system supports basic commands like save, edit and update.',
    'Version 2.0 includes a faster search and better performance.',
    'A secure website uses HTTPS and protects user information.',
    'The keyboard has 104 keys, including function and control keys.',
    'A database can store 500 records in a few seconds.',
    'Good planning saves time and improves the final result.',
]


HARD_WORDS = [
    'architecture', 'comprehensive', 'implementation',
    'configuration', 'infrastructure', 'authentication',
    'optimization', 'sophisticated', 'methodology',
    'extraordinary', 'compatibility', 'administration',
    'communication', 'responsibility', 'characteristics',
    'entrepreneurship', 'concentration', 'determination',
    'professionalism', 'environmental', 'significant',
    'independently', 'transformation', 'investigation',
    'interpretation', 'demonstration', 'efficiently',
    'consequently', 'particularly', 'approximately',
    'reliability', 'functionality', 'specification',
    'development', 'experimental', 'synchronization',
    'accessibility', 'infrastructure', 'authentication',
]


HARD_SENTENCE_TEMPLATES = [
    'The {word} requires careful planning and consistent execution.',
    'A successful {word} depends on accuracy, efficiency and reliability.',
    'Modern technology improves {word} through systematic development.',
    'The {word} process must maintain performance under demanding conditions.',
    'Developers should evaluate {word} before implementing complex solutions.',
    'Effective {word} reduces unnecessary errors and improves productivity.',
    'The organization introduced {word} to improve its existing framework.',
    'Understanding {word} requires patience, concentration and technical knowledge.',
]


HARD_MIXED_SENTENCES = [
    'The application processed 2,450 requests within 3.8 seconds.',
    'The system achieved 98.7% accuracy after 125 testing cycles.',
    'Performance improved by 35% after optimization and configuration.',
    'The server supports 8,192 connections with a 99.9% uptime target.',
    'Version 4.2 introduced 15 improvements and resolved 27 issues.',
    'The final result must remain between 75% and 100% accuracy.',
    'Developers should verify input, output and system reliability.',
    'The configuration uses ports 8080 and 443 for different services.',
    'A reliable process requires testing, validation and documentation.',
    'The algorithm reduced processing time from 12.5 to 7.2 seconds.',
]


# =========================================================
# CODE PRACTICE SNIPPETS
# =========================================================

CODE_SNIPPETS = {
    'python': [
        '''def calculate_total(price, quantity):
    discount = 0.10
    total = price * quantity
    return total - (total * discount)


items = [120, 250, 300]
result = calculate_total(sum(items), 2)
print(f"Total: {result}")''',

        '''class User:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def introduce(self):
        return f"{self.name} is {self.age} years old"


user = User("Alex", 22)
print(user.introduce())'''
    ],

    'javascript': [
        '''const users = [
    { name: "Alex", active: true },
    { name: "Sam", active: false }
];

const activeUsers = users.filter(user => {
    return user.active === true;
});

console.log(activeUsers);''',

        '''function calculateTotal(price, quantity) {
    const tax = 0.18;
    const subtotal = price * quantity;
    return subtotal + (subtotal * tax);
}

console.log(calculateTotal(500, 3));'''
    ],

    'typescript': [
        '''interface User {
    id: number;
    name: string;
    active: boolean;
}

function getUserName(user: User): string {
    return user.name;
}

const account: User = {
    id: 101,
    name: "Alex",
    active: true
};

console.log(getUserName(account));'''
    ],

    'html': [
        '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>My Website</title>
</head>
<body>
    <main class="container">
        <h1>Hello World</h1>
        <p>Welcome to my website.</p>
    </main>
</body>
</html>'''
    ],

    'css': [
        '''.container {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 20px;
    padding: 24px;
}

.container h1 {
    font-size: 2rem;
    color: #ffffff;
}'''
    ],

    'c': [
        '''#include <stdio.h>

int main(void) {
    int numbers[] = {10, 20, 30};
    int total = 0;

    for (int i = 0; i < 3; i++) {
        total += numbers[i];
    }

    printf("Total: %d\\n", total);
    return 0;
}'''
    ],

    'cpp': [
        '''#include <iostream>
#include <vector>
using namespace std;

int main() {
    vector<int> numbers = {10, 20, 30};
    int total = 0;

    for (int number : numbers) {
        total += number;
    }

    cout << "Total: " << total << endl;
    return 0;
}'''
    ],

    'java': [
        '''public class Main {
    public static void main(String[] args) {
        int[] numbers = {10, 20, 30};
        int total = 0;

        for (int number : numbers) {
            total += number;
        }

        System.out.println(total);
    }
}'''
    ],

    'csharp': [
        '''using System;

class Program {
    static void Main() {
        int[] numbers = { 10, 20, 30 };
        int total = 0;

        foreach (int number in numbers) {
            total += number;
        }

        Console.WriteLine(total);
    }
}'''
    ],

    'php': [
        '''<?php

$users = ["Alex", "Sam", "John"];

foreach ($users as $user) {
    echo "Welcome, " . $user . PHP_EOL;
}

$total = 100 + 250;
echo "Total: " . $total;

?>'''
    ],

    'sql': [
        '''SELECT
    users.name,
    COUNT(orders.id) AS total_orders
FROM users
LEFT JOIN orders
    ON users.id = orders.user_id
WHERE users.active = 1
GROUP BY users.id, users.name
ORDER BY total_orders DESC;'''
    ],

    'go': [
        '''package main

import "fmt"

func calculateTotal(numbers []int) int {
    total := 0

    for _, number := range numbers {
        total += number
    }

    return total
}

func main() {
    fmt.Println(calculateTotal([]int{10, 20, 30}))
}'''
    ],

    'rust': [
        '''fn calculate_total(numbers: &[i32]) -> i32 {
    let mut total = 0;

    for number in numbers {
        total += number;
    }

    total
}

fn main() {
    let values = [10, 20, 30];
    println!("{}", calculate_total(&values));
}'''
    ],

    'ruby': [
        '''class User
    def initialize(name, age)
        @name = name
        @age = age
    end

    def introduce
        "#{@name} is #{@age} years old"
    end
end

user = User.new("Alex", 22)
puts user.introduce'''
    ],

    'swift': [
        '''struct User {
    let name: String
    let age: Int

    func introduce() -> String {
        return "\\(name) is \\(age) years old"
    }
}

let user = User(name: "Alex", age: 22)
print(user.introduce())'''
    ],

    'kotlin': [
        '''data class User(
    val name: String,
    val age: Int
)

fun main() {
    val user = User("Alex", 22)

    if (user.age >= 18) {
        println("${user.name} is an adult")
    }
}'''
    ],

    'bash': [
        '''#!/bin/bash

name="Alex"
count=5

for ((i = 1; i <= count; i++)); do
    echo "Hello, $name - $i"
done

echo "Process completed!"'''
    ],

    'shell': [
        '''#!/bin/sh

USER_NAME="Alex"
TOTAL=100

if [ "$TOTAL" -ge 50 ]; then
    echo "Welcome, $USER_NAME"
else
    echo "Access denied"
fi'''
    ],

    'json': [
        '''{
    "name": "Alex",
    "active": true,
    "age": 22,
    "skills": [
        "Python",
        "Django",
        "JavaScript"
    ],
    "score": 95.5
}'''
    ],

    'xml': [
        '''<?xml version="1.0" encoding="UTF-8"?>
<users>
    <user id="101">
        <name>Alex</name>
        <active>true</active>
        <score>95</score>
    </user>
</users>'''
    ],

    'yaml': [
        '''application:
  name: TypeMaster
  version: 1.0

database:
  engine: sqlite
  debug: false

users:
  - name: Alex
    active: true
  - name: Sam
    active: false'''
    ],

    'dart': [
        '''class User {
    final String name;
    final int age;

    User(this.name, this.age);

    void introduce() {
        print("$name is $age years old");
    }
}

void main() {
    final user = User("Alex", 22);
    user.introduce();
}'''
    ],

    'r': [
        '''numbers <- c(10, 20, 30, 40)

total <- sum(numbers)
average <- mean(numbers)

if (average > 20) {
    print("Average is high")
}

print(total)'''
    ],

    'lua': [
        '''local users = {"Alex", "Sam", "John"}

for index, name in ipairs(users) do
    print(index .. ": " .. name)
end

local total = 100 + 250
print("Total: " .. total)'''
    ],

    'perl': [
        '''use strict;
use warnings;

my @numbers = (10, 20, 30);
my $total = 0;

foreach my $number (@numbers) {
    $total += $number;
}

print "Total: $total\\n";'''
    ],

    'scala': [
        '''object Main {
    def calculateTotal(numbers: List[Int]): Int = {
        numbers.sum
    }

    def main(args: Array[String]): Unit = {
        val values = List(10, 20, 30)
        println(calculateTotal(values))
    }
}'''
    ],

    'powershell': [
        '''$users = @("Alex", "Sam", "John")
$total = 0

foreach ($user in $users) {
    Write-Output "Welcome, $user"
    $total += 10
}

Write-Output "Total: $total"'''
    ],
}


# =========================================================
# PASSAGE GENERATORS
# =========================================================

def generate_easy_passage():
    return ' '.join(random.choices(EASY_WORDS, k=55))


def generate_normal_passage():
    sentences = []

    for _ in range(6):
        if random.random() < 0.35:
            sentences.append(random.choice(NORMAL_MIXED_SENTENCES))
        else:
            sentences.append(random.choice(NORMAL_SENTENCES))

    return ' '.join(sentences)


def generate_hard_passage():
    sentences = []

    for _ in range(8):
        word = random.choice(HARD_WORDS)
        template = random.choice(HARD_SENTENCE_TEMPLATES)
        sentences.append(template.format(word=word))

    # Add mixed numeric and symbol content without
    # making the entire test a symbol-only exercise.
    mixed_sentences = random.sample(
        HARD_MIXED_SENTENCES,
        k=4
    )

    for sentence in mixed_sentences:
        insert_at = random.randint(0, len(sentences))
        sentences.insert(insert_at, sentence)

    return ' '.join(sentences)


def generate_code_passage(language):
    snippets = CODE_SNIPPETS.get(language)

    if not snippets:
        return None

    return random.choice(snippets)


# =========================================================
# DASHBOARD
# =========================================================


def home(request):
    # Public leaderboard: normal typing results only
    user_results = (
        TestResult.objects
        .filter(difficulty__in=['easy', 'normal', 'hard'])
        .values('user_id', 'user__username')
        .annotate(
            total_tests=Count('id'),
            average_accuracy=Avg('accuracy'),
            average_wpm=Avg('wpm'),
            highest_wpm=Max('wpm'),
        )
        .order_by('-highest_wpm', '-average_accuracy')
    )

    leaderboard = []
    medal_counts = {
        'gold': 0,
        'silver': 0,
        'bronze': 0,
    }

    user_ids = [item['user_id'] for item in user_results]

    profiles = {
        profile.user_id: profile
        for profile in UserProfile.objects.filter(
            user_id__in=user_ids
        )
    }

    for item in user_results:
        tests = item['total_tests']
        accuracy = round(item['average_accuracy'] or 0, 1)

        medal = None

        if tests >= 20 and accuracy >= 97:
            medal = 'Gold'
            medal_counts['gold'] += 1
        elif tests >= 10 and accuracy >= 92:
            medal = 'Silver'
            medal_counts['silver'] += 1
        elif tests >= 5 and accuracy >= 85:
            medal = 'Bronze'
            medal_counts['bronze'] += 1

        profile = profiles.get(item['user_id'])

        leaderboard.append({
            'username': item['user__username'],
            'total_tests': tests,
            'average_accuracy': accuracy,
            'average_wpm': round(item['average_wpm'] or 0),
            'highest_wpm': item['highest_wpm'] or 0,
            'medal': medal,
            'profile_picture': (
                profile.profile_picture.url
                if profile and profile.profile_picture
                else None
            ),
        })

    preview_stats = {
        'speed': 72,
        'accuracy': 98,
        'time': 60,
    }

    if request.user.is_authenticated:
        personal_stats = TestResult.objects.filter(
            user=request.user,
            difficulty__in=['easy', 'normal', 'hard']
        ).aggregate(
            speed=Max('wpm'),
            accuracy=Max('accuracy'),
            time=Max('duration'),
        )

        preview_stats = {
            'speed': personal_stats['speed'] or 72,
            'accuracy': round(personal_stats['accuracy'] or 98),
            'time': personal_stats['time'] or 60,
        }

    return render(request, 'home/home.html', {
        'leaderboard': leaderboard[:10],
        'medal_counts': medal_counts,
        'total_players': len(user_results),
        'preview_stats': preview_stats,
    })

# =========================================================
# Result
# =========================================================

@ensure_csrf_cookie
def results(request):

    stats = {
        'total_tests': 0,
        'best_wpm': 0,
        'best_accuracy': 0,
        'average_wpm': 0,
        'average_accuracy': 0,
        'total_characters': 0,
    }

    code_summary = {
        'total_tests': 0,
        'average_wpm': 0,
        'average_accuracy': 0,
        'best_wpm': 0,
        'best_accuracy': 0,
        'total_mistakes': 0,
        'average_mistakes': 0,
    }

    recent_results = []
    chart_data = []
    typing_chart_data = []
    code_chart_data = []
    code_language_stats = []
    code_recent_results = []

    page_obj = None
    max_wpm = 0

    difficulty_stats = [
        {
            'difficulty': 'Easy',
            'total_tests': 0,
            'average_wpm': 0,
            'average_accuracy': 0,
        },
        {
            'difficulty': 'Normal',
            'total_tests': 0,
            'average_wpm': 0,
            'average_accuracy': 0,
        },
        {
            'difficulty': 'Hard',
            'total_tests': 0,
            'average_wpm': 0,
            'average_accuracy': 0,
        },
    ]

    if request.user.is_authenticated:

        # User-specific results only.
        results = TestResult.objects.filter(
            user=request.user
        )

        # Separate normal typing and code results.
        typing_results = results.filter(
            difficulty__in=['easy', 'normal', 'hard']
        )

        code_results = results.filter(
            difficulty='code'
        )

        # NORMAL TYPING SUMMARY
        summary = typing_results.aggregate(
            best_wpm=Max('wpm'),
            best_accuracy=Max('accuracy'),
            average_wpm=Avg('wpm'),
            average_accuracy=Avg('accuracy'),
            total_characters=Sum('correct_characters'),
        )

        stats = {
            'total_tests': typing_results.count(),
            'best_wpm': summary['best_wpm'] or 0,
            'best_accuracy': summary['best_accuracy'] or 0,
            'average_wpm': round(summary['average_wpm'] or 0),
            'average_accuracy': round(
                summary['average_accuracy'] or 0, 1
            ),
            'total_characters': summary['total_characters'] or 0,
        }

        # NORMAL DIFFICULTY CARDS
        difficulty_data = (
            typing_results
            .values('difficulty')
            .annotate(
                total_tests=Count('id'),
                average_wpm=Avg('wpm'),
                average_accuracy=Avg('accuracy'),
            )
        )

        for item in difficulty_data:
            for card in difficulty_stats:

                if card['difficulty'].lower() == item['difficulty']:

                    card['total_tests'] = item['total_tests']

                    card['average_wpm'] = round(
                        item['average_wpm'] or 0
                    )

                    card['average_accuracy'] = round(
                        item['average_accuracy'] or 0, 1
                    )

                    break

        # EXISTING HISTORY FILTERS
        difficulty = request.GET.get('difficulty', '')
        date_from = request.GET.get('date_from', '')
        date_to = request.GET.get('date_to', '')

        filtered_results = results

        if difficulty in ['easy', 'normal', 'hard', 'code']:
            filtered_results = filtered_results.filter(
                difficulty=difficulty
            )

        parsed_date_from = (
            parse_date(date_from) if date_from else None
        )

        parsed_date_to = (
            parse_date(date_to) if date_to else None
        )

        if parsed_date_from:
            filtered_results = filtered_results.filter(
                created_at__date__gte=parsed_date_from
            )

        if parsed_date_to:
            filtered_results = filtered_results.filter(
                created_at__date__lte=parsed_date_to
            )

        # PAGINATION: 5 RESULTS PER PAGE
        paginator = Paginator(
            filtered_results.order_by('-created_at'),
            5
        )

        page_obj = paginator.get_page(
            request.GET.get('page')
        )

        recent_results = page_obj.object_list

        max_wpm = max(
            (result.wpm for result in recent_results),
            default=0
        )

        # NORMAL TYPING CHART
        typing_chart_results = list(
            typing_results.order_by('-created_at')[:10]
        )

        typing_chart_results.reverse()

        typing_chart_data = [
            {
                'date': result.created_at.strftime('%d %b'),
                'wpm': result.wpm,
                'accuracy': result.accuracy,
            }
            for result in typing_chart_results
        ]

        # CODE MODE CHART
        code_chart_results = list(
            code_results.order_by('-created_at')[:10]
        )

        code_chart_results.reverse()

        code_chart_data = [
            {
                'date': result.created_at.strftime('%d %b'),
                'wpm': result.wpm,
                'accuracy': result.accuracy,
            }
            for result in code_chart_results
        ]

        # CODE MODE SUMMARY
        code_aggregate = code_results.aggregate(
            total_tests=Count('id'),
            average_wpm=Avg('wpm'),
            average_accuracy=Avg('accuracy'),
            best_wpm=Max('wpm'),
            best_accuracy=Max('accuracy'),
            total_mistakes=Sum('mistakes'),
            average_mistakes=Avg('mistakes'),
        )

        code_summary = {
            'total_tests': code_aggregate['total_tests'] or 0,
            'average_wpm': round(
                code_aggregate['average_wpm'] or 0
            ),
            'average_accuracy': round(
                code_aggregate['average_accuracy'] or 0, 1
            ),
            'best_wpm': code_aggregate['best_wpm'] or 0,
            'best_accuracy': code_aggregate['best_accuracy'] or 0,
            'total_mistakes': code_aggregate['total_mistakes'] or 0,
            'average_mistakes': round(
                code_aggregate['average_mistakes'] or 0, 1
            ),
        }

        # LANGUAGE-WISE CODE ANALYTICS
        language_data = (
            code_results
            .values('language')
            .annotate(
                total_tests=Count('id'),
                average_wpm=Avg('wpm'),
                average_accuracy=Avg('accuracy'),
                best_wpm=Max('wpm'),
                total_mistakes=Sum('mistakes'),
                average_mistakes=Avg('mistakes'),
            )
            .order_by('language')
        )

        language_names = dict(TestResult.LANGUAGE_CHOICES)

        code_language_stats = [
            {
                'language': item['language'],
                'language_name': language_names.get(
                    item['language'],
                    item['language'].upper()
                ),
                'total_tests': item['total_tests'],
                'average_wpm': round(
                    item['average_wpm'] or 0
                ),
                'average_accuracy': round(
                    item['average_accuracy'] or 0, 1
                ),
                'best_wpm': item['best_wpm'] or 0,
                'total_mistakes': item['total_mistakes'] or 0,
                'average_mistakes': round(
                    item['average_mistakes'] or 0, 1
                ),
            }
            for item in language_data
        ]

        # LATEST 10 CODE TESTS
        code_recent_results = list(
            code_results.order_by('-created_at')[:10]
        )

        # Keep existing chart_data compatibility.
        chart_data = typing_chart_data

    return render(request, 'base/index.html', {
        'stats': stats,
        'code_summary': code_summary,
        'recent_results': recent_results,
        'chart_data': chart_data,
        'typing_chart_data': typing_chart_data,
        'code_chart_data': code_chart_data,
        'code_language_stats': code_language_stats,
        'code_recent_results': code_recent_results,
        'page_obj': page_obj,
        'max_wpm': max_wpm,
        'difficulty_stats': difficulty_stats,
        'selected_difficulty': request.GET.get('difficulty', ''),
        'date_from': request.GET.get('date_from', ''),
        'date_to': request.GET.get('date_to', ''),
    })


# =========================================================
# AUTHENTICATION
# =========================================================

def signup(request):

    if request.user.is_authenticated:
        return redirect('home')

    if request.method == 'POST':
        form = CustomUserCreationForm(request.POST)

        if form.is_valid():
            user = form.save()

            UserProfile.objects.get_or_create(
                user=user
            )

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
        form = AuthenticationForm(
            request,
            data=request.POST
        )

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


# =========================================================
# PROFILE
# =========================================================


@login_required
def user_profile(request):

    profile, created = UserProfile.objects.get_or_create(
        user=request.user
    )

    results = TestResult.objects.filter(user=request.user)

    summary = results.aggregate(
        total_tests=Count('id'),
        best_wpm=Max('wpm'),
        best_accuracy=Max('accuracy'),
        average_wpm=Avg('wpm'),
        average_accuracy=Avg('accuracy'),
        total_characters=Sum('correct_characters'),
        total_mistakes=Sum('mistakes'),
    )

    code_results = results.filter(difficulty='code')
    typing_results = results.exclude(difficulty='code')

    best_result = results.order_by(
        '-wpm',
        '-created_at'
    ).first()

    profile_stats = {
        'total_tests': summary['total_tests'] or 0,
        'best_wpm': summary['best_wpm'] or 0,
        'best_accuracy': round(summary['best_accuracy'] or 0, 1),
        'average_wpm': round(summary['average_wpm'] or 0),
        'average_accuracy': round(
            summary['average_accuracy'] or 0, 1
        ),
        'total_characters': summary['total_characters'] or 0,
        'total_mistakes': summary['total_mistakes'] or 0,
        'typing_tests': typing_results.count(),
        'code_tests': code_results.count(),
    }

    return render(request, 'profile/profile.html', {
        'profile': profile,
        'profile_stats': profile_stats,
        'best_result': best_result,
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
        user_form = UserUpdateForm(
            instance=request.user
        )

        profile_form = ProfileUpdateForm(
            instance=profile
        )

    return render(request, 'profile/edit_profile.html', {
        'user_form': user_form,
        'profile_form': profile_form,
        'profile': profile
    })


# =========================================================
# SAVE TEST RESULT
# =========================================================

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
        correct_characters = int(
            data.get('correct_characters', 0)
        )
        mistakes = int(data.get('mistakes', 0))
        duration = int(data.get('duration', 0))

        difficulty = data.get('difficulty', 'normal')
        language = data.get('language', '').lower().strip()

        valid_difficulties = [
            'easy', 'normal', 'hard', 'code'
        ]

        valid_languages = dict(
            TestResult.LANGUAGE_CHOICES
        )

        if (
            wpm < 0 or
            not 0 <= accuracy <= 100 or
            correct_characters < 0 or
            mistakes < 0 or
            duration not in [15, 30, 60, 120] or
            difficulty not in valid_difficulties
        ):
            return JsonResponse({
                'success': False,
                'message': 'Invalid test result data.'
            }, status=400)

        if difficulty == 'code':
            if language not in valid_languages:
                return JsonResponse({
                    'success': False,
                    'message': 'Please select a valid programming language.'
                }, status=400)
        else:
            language = ''

        result = TestResult.objects.create(
            user=request.user,
            wpm=wpm,
            accuracy=accuracy,
            correct_characters=correct_characters,
            mistakes=mistakes,
            duration=duration,
            difficulty=difficulty,
            language=language,
        )

        return JsonResponse({
            'success': True,
            'message': 'Test result saved successfully.',
            'result_id': result.id
        })

    except (
        ValueError,
        TypeError,
        json.JSONDecodeError
    ):
        return JsonResponse({
            'success': False,
            'message': 'Invalid request data.'
        }, status=400)


# =========================================================
# GENERATE TYPING PASSAGE
# =========================================================

def generate_passage(request):

    difficulty = request.GET.get(
        'difficulty',
        'normal'
    ).lower().strip()

    if difficulty == 'easy':
        text = generate_easy_passage()

        return JsonResponse({
            'success': True,
            'difficulty': 'easy',
            'text': text,
            'word_count': len(text.split()),
        })

    if difficulty == 'normal':
        text = generate_normal_passage()

        return JsonResponse({
            'success': True,
            'difficulty': 'normal',
            'text': text,
            'word_count': len(text.split()),
        })

    if difficulty == 'hard':
        text = generate_hard_passage()

        return JsonResponse({
            'success': True,
            'difficulty': 'hard',
            'text': text,
            'word_count': len(text.split()),
        })

    if difficulty == 'code':

        language = request.GET.get(
            'language',
            'python'
        ).lower().strip()

        valid_languages = dict(
            TestResult.LANGUAGE_CHOICES
        )

        if language not in valid_languages:
            return JsonResponse({
                'success': False,
                'message': 'Unsupported programming language.'
            }, status=400)

        text = generate_code_passage(language)

        if text is None:
            return JsonResponse({
                'success': False,
                'message': 'No practice snippet available for this language.'
            }, status=404)

        return JsonResponse({
            'success': True,
            'difficulty': 'code',
            'language': language,
            'text': text,
            'word_count': len(text.split()),
        })

    return JsonResponse({
        'success': False,
        'message': 'Invalid difficulty selected.'
    }, status=400)


# =========================================================
# SPACE TYPING SHOOTER
# =========================================================

# SPACE SHOOTER

@ensure_csrf_cookie
def space_shooter(request):
    stats = {
        'total_games': 0,
        'best_score': 0,
        'average_wpm': 0,
        'average_accuracy': 0,
    }

    history = []
    game_chart_data = []

    difficulty_stats = [
        {
            'difficulty': 'Easy',
            'total_games': 0,
            'average_wpm': 0,
            'average_accuracy': 0,
        },
        {
            'difficulty': 'Normal',
            'total_games': 0,
            'average_wpm': 0,
            'average_accuracy': 0,
        },
        {
            'difficulty': 'Hard',
            'total_games': 0,
            'average_wpm': 0,
            'average_accuracy': 0,
        },
        {
            'difficulty': 'Extreme',
            'total_games': 0,
            'average_wpm': 0,
            'average_accuracy': 0,
        },
    ]

    if request.user.is_authenticated:
        results = SpaceShooterResult.objects.filter(
            user=request.user
        )

        summary = results.aggregate(
            total_games=Count('id'),
            best_score=Max('score'),
            average_wpm=Avg('wpm'),
            average_accuracy=Avg('accuracy'),
        )

        stats = {
            'total_games': summary['total_games'] or 0,
            'best_score': summary['best_score'] or 0,
            'average_wpm': round(summary['average_wpm'] or 0),
            'average_accuracy': round(
                summary['average_accuracy'] or 0, 1
            ),
        }

        # DIFFICULTY-WISE ANALYTICS
        difficulty_data = (
            results
            .values('difficulty')
            .annotate(
                total_games=Count('id'),
                average_wpm=Avg('wpm'),
                average_accuracy=Avg('accuracy'),
            )
        )

        for item in difficulty_data:
            for card in difficulty_stats:
                if card['difficulty'].lower() == item['difficulty']:
                    card['total_games'] = item['total_games']
                    card['average_wpm'] = round(
                        item['average_wpm'] or 0
                    )
                    card['average_accuracy'] = round(
                        item['average_accuracy'] or 0, 1
                    )
                    break

        history = list(
            results.order_by('-created_at')[:10]
        )

        chart_results = list(
            results.order_by('-created_at')[:10]
        )

        chart_results.reverse()

        game_chart_data = [
            {
                'date': result.created_at.strftime('%d %b'),
                'wpm': result.wpm,
                'accuracy': float(result.accuracy),
            }
            for result in chart_results
        ]

    return render(request, 'games/space_shooter/home.html', {
        'stats': stats,
        'history': history,
        'game_chart_data': game_chart_data,
        'difficulty_stats': difficulty_stats,
    })


# SPACE SHOOTER - GAME PAGE

@login_required
@ensure_csrf_cookie
def space_shooter_game(request):
    difficulty = request.GET.get('difficulty', 'normal')

    if difficulty not in ['easy', 'normal', 'hard', 'extreme']:
        difficulty = 'normal'

    return render(request, 'games/space_shooter/game.html', {
        'difficulty': difficulty,
    })


# SPACE SHOOTER - RESULT PAGE

@login_required
def space_shooter_result(request, result_id):
    result = SpaceShooterResult.objects.get(
        id=result_id,
        user=request.user
    )

    return render(request, 'games/space_shooter/result.html', {
        'result': result,
    })


# SPACE SHOOTER - SAVE RESULT

@require_POST
@csrf_protect
def save_space_shooter_result(request):

    if not request.user.is_authenticated:
        return JsonResponse(
            {'error': 'Login required'},
            status=401
        )

    try:
        data = json.loads(request.body)

        difficulty = data.get('difficulty', 'normal')

        if difficulty not in ['easy', 'normal', 'hard', 'extreme']:
            return JsonResponse(
                {'error': 'Invalid difficulty'},
                status=400
            )

        result = SpaceShooterResult.objects.create(
            user=request.user,
            difficulty=difficulty,
            score=max(0, int(data.get('score', 0))),
            wpm=max(0, int(data.get('wpm', 0))),
            accuracy=max(0, min(100, float(data.get('accuracy', 0)))),
            words_destroyed=max(0, int(data.get('words_destroyed', 0))),
            missed_words=max(0, int(data.get('missed_words', 0))),
            mistakes=max(0, int(data.get('mistakes', 0))),
            shots_fired=max(0, int(data.get('shots_fired', 0))),
            highest_wave=max(1, int(data.get('highest_wave', 1))),
            duration=max(0, int(data.get('duration', 0))),
        )

        return JsonResponse({
            'success': True,
            'result_id': result.id
        })

    except (ValueError, TypeError, json.JSONDecodeError):
        return JsonResponse(
            {'error': 'Invalid result data'},
            status=400
        )
"""
Django settings for the publishing_api project (Studio).

Environment variables (set in .env for local dev, Railway dashboard for prod):
  SECRET_KEY          Django secret key
  DEBUG               "True" for local, "False" in production
  DATABASE_URL        Postgres connection string (provided by Railway)
  ALLOWED_HOSTS       Comma-separated allowed hostnames
  GITHUB_TOKEN        GitHub PAT with repo scope
  GITHUB_REPO         Owner/repo format (e.g. "travisgilbert/website")
  GITHUB_BRANCH       Target branch (default: "main")
"""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

# Add apps/ to Python path so we can use "apps.core" imports
sys.path.insert(0, str(BASE_DIR))

SECRET_KEY = os.environ.get("SECRET_KEY", "dev-insecure-key-change-in-production")

DEBUG = os.environ.get("DEBUG", "True") == "True"

ALLOWED_HOSTS_RAW = os.environ.get("ALLOWED_HOSTS", "localhost,127.0.0.1")
ALLOWED_HOSTS = [h.strip() for h in ALLOWED_HOSTS_RAW.split(",")]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "whitenoise.runserver_nostatic",
    "django.contrib.staticfiles",
    # Brand component libraries
    "django_cotton.apps.SimpleAppConfig",
    "template_partials",
    "tailwind",
    "theme",
    "crispy_forms",
    "crispy_studio",
    # Project apps
    "apps.core",
    "apps.content",
    "apps.publisher",
    "apps.editor",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "OPTIONS": {
            "loaders": [
                (
                    "template_partials.loader.Loader",
                    [
                        (
                            "django.template.loaders.cached.Loader",
                            [
                                "django_cotton.cotton_loader.Loader",
                                "django.template.loaders.filesystem.Loader",
                                "django.template.loaders.app_directories.Loader",
                            ],
                        )
                    ],
                )
            ],
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
                "apps.editor.context_processors.sidebar_counts",
            ],
            "builtins": [
                "django_cotton.templatetags.cotton",
                "template_partials.templatetags.partials",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# Database: use DATABASE_URL if set (Railway), else SQLite for local dev
DATABASE_URL = os.environ.get("DATABASE_URL", "")
if DATABASE_URL:
    import urllib.parse
    url = urllib.parse.urlparse(DATABASE_URL)
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": url.path.lstrip("/"),
            "USER": url.username,
            "PASSWORD": url.password,
            "HOST": url.hostname,
            "PORT": url.port or 5432,
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

AUTH_USER_MODEL = "core.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LOGIN_URL = "/accounts/login/"
LOGIN_REDIRECT_URL = "/"
LOGOUT_REDIRECT_URL = "/accounts/login/"

LANGUAGE_CODE = "en-us"
TIME_ZONE = "America/Chicago"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [BASE_DIR / "static"]
STORAGES = {
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Crispy Forms
CRISPY_TEMPLATE_PACK = "studio"
CRISPY_ALLOWED_TEMPLATE_PACKS = ("studio",)

# Tailwind
TAILWIND_APP_NAME = "theme"

# Logging: send errors to stderr so Railway captures tracebacks
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "[{levelname}] {name}: {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": "WARNING",
        },
        "django.request": {
            "handlers": ["console"],
            "level": "ERROR",
            "propagate": False,
        },
    },
}

# GitHub publishing settings (strip whitespace; dashboard paste can add newlines)
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "").strip()
GITHUB_REPO = os.environ.get("GITHUB_REPO", "").strip()
GITHUB_BRANCH = os.environ.get("GITHUB_BRANCH", "main").strip()

# Production security (only when DEBUG=False)
if not DEBUG:
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    CSRF_TRUSTED_ORIGINS = [
        f"https://{h.strip()}"
        for h in ALLOWED_HOSTS_RAW.split(",")
        if h.strip() and h.strip() != "*"
    ]

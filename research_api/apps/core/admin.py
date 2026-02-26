from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User

admin.site.register(User, UserAdmin)

admin.site.site_header = 'Research API'
admin.site.site_title = 'Research API Admin'
admin.site.index_title = 'Research Source Tracking'

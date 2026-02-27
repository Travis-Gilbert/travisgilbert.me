"""Template tags for Paper Trail templates."""

from django import template

register = template.Library()

ROLE_COLORS = {
    'primary':          '#B45A2D',
    'background':       '#9A8E82',
    'inspiration':      '#C49A4A',
    'data':             '#5A7A4A',
    'counterargument':  '#A44A3A',
    'methodology':      '#2D5F6B',
    'reference':        '#6A5E52',
}


@register.simple_tag
def role_color(role):
    """Return the hex color for a SourceLink role value."""
    return ROLE_COLORS.get(role, '#6A5E52')

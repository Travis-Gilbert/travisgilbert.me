"""
TickTick sync stubs for video production pipeline.

These functions define the sync interface between Studio and TickTick.
Implementation will be connected when the TickTick MCP is wired to Studio.
The data model and interface are defined here so the MCP integration
has a clean target.
"""


def sync_to_ticktick(video):
    """
    Creates or updates TickTick tasks for the video project.
    One task per phase in the Video Breakdown list.
    Active phase gets priority 5 (HIGH).
    Future phases get priority 3 (MEDIUM).
    Completed phases get priority 1 (LOW).
    """
    pass


def create_phase_task(video, phase: str):
    """
    Creates a TickTick task for a specific phase with subtasks
    derived from the video's scenes.
    Task title format: "[Short Title]: P[#] [Phase Name]"
    """
    pass


def sync_from_ticktick(video):
    """
    Reads TickTick task state and updates the VideoProject.
    Called when opening the video editor to catch any changes
    made directly in TickTick.
    """
    pass

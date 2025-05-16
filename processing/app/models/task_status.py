from enum import StrEnum


class TaskStatus(StrEnum):
    NULL = "null"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ERROR = "error"
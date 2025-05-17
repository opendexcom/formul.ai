import uuid

from app.core import config
from app.db.sessions import IntegrityError
from app.db.sessions import get_async_engine
from app.db.sessions import get_async_session_factory
from app.models.survey_answer import SurveyAnswer
from app.models.task import Task


async def load_initial_data():
    cfg = config.PostgresSettings.from_env()

    task = Task(
        id=uuid.UUID("610c3050-0d86-4f6f-b7a6-759a42732f17"),
        survey_id=uuid.UUID("6cb2588c-a93b-41fe-a4a3-9b08280f4e97"),
    )
    session_factory = get_async_session_factory(get_async_engine(cfg))

    async with session_factory() as session:
        session.add(task)
        try:
            # Prepare for task creation, but not commit
            await session.flush()
        except IntegrityError:
            # Task already exists
            await session.rollback()
            return

        answers = [
            SurveyAnswer(survey_id=task.survey_id, answers_json=answer)
            for answer in [
                "I like that we’re using real-world tools like Docker and microservices — good exposure. But honestly, coordination’s been messy. We need clearer ownership per service.",
                "It’s cool we’re blending multiple languages and tools, but context-switching between Java and Python is painful. Feels like overkill for a student project.",
                "I love how ambitious the project is, especially using AI for survey analysis — feels meaningful. But the team’s all over the place skill-wise, which slows things down.",
                "I like that we’re using GitHub seriously — issues, branches, pull requests. But half the team still doesn’t really know Git, which makes merges frustrating.",
                "React frontend looks solid so far, props to whoever’s owning that. But we still haven’t nailed down our API contracts, and it’s breaking stuff constantly.",
                "Cool idea and stack, but we probably should’ve picked one backend language. Java + Python + microservices = too many moving parts for a mostly newbie team.",
                "Docker is a great learning experience — finally feels like we’re building something 'real.' Downside is debugging containers eats way too much time.",
                "I like that we’re treating it like a real product — planning, meetings, reviews. But I wish we spent less time in meetings and more actually coding.",
                "Feels good seeing everyone improve. Some people came in barely knowing Git, now they’re doing pull requests. But onboarding new members is still painful.",
                "I’m proud we’re pulling off microservices, even in a rough way. Just wish we spent more time upfront defining how they’d talk to each other.",
                "Survey AI analysis is a solid use case. But labeling training data manually? Ugh. We need a better workflow for that.",
                "Really like how we split work — frontend/backend/devops. But we’re lacking real integration testing, so services often don’t play nice.",
                "Fun project, even if chaotic. Everyone’s learning fast. But we need more code reviews — too many bugs sneak in.",
                "Honestly, I’m surprised how far we’ve come given how many of us started clueless. But I’d kill for a better README and setup guide.",
                "Cool tech stack, solid project idea, and I like the energy. But right now, too much tech for too little process — we need to simplify or organize better.",
            ]
        ]

        session.add_all(answers)
        try:
            await session.commit()
        except IntegrityError:
            await session.rollback()
            return

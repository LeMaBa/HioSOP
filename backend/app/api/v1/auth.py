from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.auth import get_current_user
from app.models.user import User, UserRole
from app.schemas.user import Token, LoginRequest, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])


async def authenticate_local(username: str, password: str, db: AsyncSession) -> User | None:
    result = await db.execute(select(User).where(User.username == username, User.is_active == True))
    user = result.scalar_one_or_none()
    if not user or not user.hashed_password:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


async def authenticate_ldap(username: str, password: str) -> bool:
    """Attempt LDAP authentication. Returns True on success."""
    try:
        import ldap
        from app.core.config import settings
        if not settings.ldap_enabled:
            return False
        conn = ldap.initialize(f"ldap://{settings.LDAP_SERVER}:{settings.LDAP_PORT}")
        conn.set_option(ldap.OPT_REFERRALS, 0)
        conn.set_option(ldap.OPT_NETWORK_TIMEOUT, 5)
        if settings.LDAP_BIND_DN and settings.LDAP_BIND_PASSWORD:
            conn.simple_bind_s(settings.LDAP_BIND_DN, settings.LDAP_BIND_PASSWORD)
        search_filter = f"({settings.LDAP_USER_ATTR}={username})"
        results = conn.search_s(
            settings.LDAP_USER_SEARCH_BASE or settings.LDAP_BASE_DN,
            ldap.SCOPE_SUBTREE,
            search_filter,
            ["dn", "cn", "mail"],
        )
        if not results:
            return False
        user_dn = results[0][0]
        conn.simple_bind_s(user_dn, password)
        return True
    except Exception:
        return False


@router.post("/login", response_model=Token)
async def login(request: Request, payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await authenticate_local(payload.username, payload.password, db)

    if not user:
        from app.core.config import settings
        if settings.ldap_enabled:
            ldap_ok = await authenticate_ldap(payload.username, payload.password)
            if ldap_ok:
                # Ensure local shadow user exists
                result = await db.execute(select(User).where(User.username == payload.username))
                user = result.scalar_one_or_none()
                if not user:
                    user = User(
                        username=payload.username,
                        email=f"{payload.username}@ldap.local",
                        full_name=payload.username,
                        role=UserRole.DISPATCHER,
                        is_ldap_user=True,
                    )
                    db.add(user)
                    await db.commit()
                    await db.refresh(user)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Ungültiger Benutzername oder Passwort",
        )

    user.last_login = datetime.now(timezone.utc)
    await db.commit()

    token = create_access_token({"sub": user.id})
    return Token(access_token=token, user=UserResponse.model_validate(user))


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)


@router.post("/logout")
async def logout():
    # Token invalidation handled client-side; server-side blacklist can be added later
    return {"message": "Abmeldung erfolgreich"}

from fastapi import Depends, HTTPException, status
from typing import List
from utils.auth import get_current_user


class RoleChecker:
    def __init__(self, allowed_role: str):
        self.allowed_role = allowed_role
        
    def __call__(self, user = Depends(get_current_user)):
        if not user:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Требуется аутентификация"
            )   
        
        user_role = user.role
        
        if "admin" == user_role:
            return user
        
        if user_role != self.allowed_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Недостаточно прав. Требуется роль: {self.allowed_role}"
            )
        
        return user


admin = RoleChecker("admin")
# # Создание темы в курсе
# @router.post("/courses/{course_id}/themes/", response_model=ThemeResponse)
# def create_theme(course_id: int, theme_data: ThemeCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_teacher)):

# # Обновление темы
# @router.put("/themes/{theme_id}", response_model=ThemeResponse)
# def update_theme(theme_id: int, theme_data: ThemeUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_teacher)):

# # Удаление темы
# @router.delete("/themes/{theme_id}")
# def delete_theme(theme_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_teacher)):

# # Загрузка файлов к теме
# @router.post("/themes/{theme_id}/files/", response_model=FileResponse)
# def upload_theme_file(theme_id: int, file: UploadFile = File(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_teacher)):
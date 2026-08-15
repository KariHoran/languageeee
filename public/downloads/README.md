# Android APK (optional)

Положите сюда файл `languageeee.apk` после сборки:

```bash
npx eas-cli login
npx eas-cli build -p android --profile preview
# скачайте APK и скопируйте:
#   public/downloads/languageeee.apk
```

Сайт покажет кнопку «Скачать APK», если файл доступен по `/downloads/languageeee.apk`.

Пока файла нет, пользователи ставят приложение с сайта как PWA (Chrome → Установить).

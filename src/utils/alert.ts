import { Alert, Platform } from 'react-native';

/** Показывает предупреждение на всех платформах, включая web */
export function showAlert(title: string, message: string): void {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}

/** Диалог подтверждения. На web — window.confirm. */
export function showConfirm(
  title: string,
  message: string,
  onConfirm: () => void,
  confirmLabel = 'Удалить',
  cancelLabel = 'Отмена'
): void {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
    return;
  }

  Alert.alert(title, message, [
    { text: cancelLabel, style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}

# InputManager

Централизованная система обработки ввода.

## Что это решает:

- **До**: Обработчики клавиш размазаны по 3 разным `useEffect` в `Game.jsx`
- **После**: Весь ввод обрабатывается одним классом `InputManager`

## Преимущества:

1. **Переназначение клавиш**: Изменить клавишу можно в одном месте (`keyMap`)
2. **Тестируемость**: Можно юнит-тестировать без React
3. **Поддержка геймпада**: Легко добавить геймпад, мапя его на те же `INPUT_ACTIONS`
4. **Отключение ввода**: Можно отключить ввод одной командой (`setEnabled(false)`)

## Использование:

```javascript
import { InputManager, INPUT_ACTIONS } from '../core/input/InputManager';

const inputManager = new InputManager();

// Регистрируем обработчик
inputManager.on(INPUT_ACTIONS.DROP_ITEM, () => {
  console.log('Выброшен предмет');
});

// Подключаем к DOM
inputManager.attach();

// Обновляем состояние pointer lock
inputManager.setPointerLocked(true);

// Cleanup
inputManager.destroy();
```

## Добавление новых действий:

1. Добавить действие в `INPUT_ACTIONS`
2. Добавить клавишу в `keyMap`
3. Зарегистрировать обработчик через `.on()`

## Изменения в Game.jsx:

- **Удалено**: 3 `useEffect` с `addEventListener`
- **Добавлено**: 1 `useEffect` с инициализацией `InputManager`
- **Результат**: ~60 строк кода превратились в ~30 строк

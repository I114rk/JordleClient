import React, { useState, useEffect } from 'react';
import './App.css';

// Макет русской клавиатуры (3 ряда)
const KEYBOARD_ROWS = [
    ['Й', 'Ц', 'У', 'К', 'Е', 'Н', 'Г', 'Ш', 'Щ', 'З', 'Х', 'Ъ'],
    ['Ф', 'Ы', 'В', 'А', 'П', 'Р', 'О', 'Л', 'Д', 'Ж', 'Э'],
    ['ENTER', 'Я', 'Ч', 'С', 'М', 'И', 'Т', 'Ь', 'Б', 'Ю', 'Ё', 'BACKSPACE']
];
const ALL_RUSSIAN_KEYS = "ЙЦУКЕНГШЩЗХЪФЫВАПРОЛДЖЭЯЧСМИТЬБЮЁ";


function App() {
  const [history, setHistory] = useState([]); 
  const [currentGuess, setCurrentGuess] = useState(''); 
  const [isGameOver, setIsGameOver] = useState(false);
  const [solution, setSolution] = useState(null); 
  const [keyboardStatus, setKeyboardStatus] = useState(() => {
    const status = {};
    for (const char of ALL_RUSSIAN_KEYS) {
        status[char] = 'default';
    }
    return status;
  });
  
  // НОВЫЕ СОСТОЯНИЯ: Ошибки и Словарь
  const [errorMessage, setErrorMessage] = useState(null);
  const [isDictionaryOpen, setIsDictionaryOpen] = useState(false);
  const [fullDictionary, setFullDictionary] = useState([]);

  // URL'ы
  const BASE_API_URL = process.env.NODE_ENV === 'production' 
    ? 'https://jordlewebservice.onrender.com'
    : 'http://localhost:3001';

  const CHECK_WORD_URL = `${BASE_API_URL}/check-word`;
  const NEW_GAME_URL = `${BASE_API_URL}/new-game`;
  const DICTIONARY_URL = `${BASE_API_URL}/dictionary`;


  // 1. ЛОГИКА ЗАГРУЗКИ: Загружаем словарь и сбрасываем игру при первом запуске
  useEffect(() => {
    // 1.1. Загрузка словаря
    fetch(DICTIONARY_URL)
        .then(res => res.json())
        .then(data => setFullDictionary(data))
        .catch(error => console.error("Не удалось загрузить словарь:", error));
    
    // 1.2. Сброс слова на сервере при монтировании (решает проблему "необновления" слова при refresh)
    reloadGame(true); 

  }, []); // Пустой массив, чтобы сработало один раз


  const handleKeyClick = (key) => {
      if (isGameOver) return;
      if (isDictionaryOpen) return; // Блокируем ввод при открытом словаре
      
      // Скрываем ошибку при новом вводе
      setErrorMessage(null); 
      
      if (key === 'ENTER') {
          if (currentGuess.length === 5) {
              submitGuess();
          }
      } else if (key === 'BACKSPACE') {
          setCurrentGuess((prev) => prev.slice(0, -1));
      } else {
          if (currentGuess.length < 5) {
              setCurrentGuess((prev) => prev + key);
          }
      }
  };


  useEffect(() => {
    const handleKey = (e) => {
      let key = e.key.toUpperCase();
      
      // Обработка Ё/E
      if (key === 'E' && currentGuess.length < 5 && !ALL_RUSSIAN_KEYS.includes('E')) {
          key = 'Ё';
      }

      if (ALL_RUSSIAN_KEYS.includes(key) || key === 'ENTER' || key === 'BACKSPACE') {
          handleKeyClick(key);
      }
    };

    window.addEventListener('keyup', handleKey);
    return () => window.removeEventListener('keyup', handleKey);
  }, [currentGuess, isGameOver, isDictionaryOpen]);


  const submitGuess = async () => {
    const isLastAttempt = history.length === 5; 
    
    try {
      const response = await fetch(CHECK_WORD_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          guess: currentGuess,
          attemptNumber: history.length
        }),
      });

      const data = await response.json();

      if (response.status !== 200) {
        // 3. ОБРАБОТКА ОШИБКИ ВАЛИДАЦИИ СЛОВА
        setErrorMessage(data.error);
        return; 
      }
      
      setErrorMessage(null); // Сброс ошибки, если успешно

      const guessChars = currentGuess.toUpperCase().split('');
      const newKeyboardStatus = { ...keyboardStatus };

      guessChars.forEach((char, index) => {
          const maskVal = data.mask[index];
          let newStatus = 'default';

          if (maskVal === 2) { newStatus = 'green'; } 
          else if (maskVal === 1) { newStatus = 'yellow'; } 
          else if (maskVal === 0) { newStatus = 'red'; } 
          
          const currentPriority = { 'green': 3, 'yellow': 2, 'red': 1, 'default': 0 }[newKeyboardStatus[char]];
          const newPriority = { 'green': 3, 'yellow': 2, 'red': 1, 'default': 0 }[newStatus];

          if (newPriority >= currentPriority) {
              newKeyboardStatus[char] = newStatus;
          }
      });

      setKeyboardStatus(newKeyboardStatus); 

      const newAttempt = { word: currentGuess, mask: data.mask };
      setHistory((prev) => [...prev, newAttempt]);
      setCurrentGuess('');

      if (data.isWin || isLastAttempt) {
        setIsGameOver(true);
        setSolution(data.solution); 
      }

    } catch (error) {
      console.error('Ошибка соединения с сервером:', error);
      setErrorMessage('ОШИБКА: Сервер не отвечает.');
    }
  };

  const reloadGame = async (isInitialLoad = false) => {
    try {
        await fetch(NEW_GAME_URL);
        
        const defaultStatus = {};
        for (const char of ALL_RUSSIAN_KEYS) {
            defaultStatus[char] = 'default';
        }
        setKeyboardStatus(defaultStatus);
        
        setHistory([]);
        setCurrentGuess('');
        setIsGameOver(false);
        setSolution(null);
        setErrorMessage(null);

        // Если это не первая загрузка, перезагружаем страницу, чтобы обновить UI
        if (!isInitialLoad) {
            window.location.reload(); 
        }

    } catch (error) {
        console.error('Ошибка сброса игры:', error);
        if (!isInitialLoad) {
             window.location.reload(); 
        }
    }
  };


  // КОМПОНЕНТ "СЛОВАРЬ ИГРЫ"
  const DictionaryModal = () => (
    <div className="dictionary-modal" onClick={() => setIsDictionaryOpen(false)}>
      <div className="dictionary-content" onClick={(e) => e.stopPropagation()}>
        <h2>Словарь JORDLE ({fullDictionary.length})</h2>
        <div className="dictionary-list">
          {fullDictionary.map((entry, index) => (
            <div key={index} className="dict-entry">
              <span className="dict-word">{entry.word}</span>
              <span className="dict-desc">{entry.desc}</span>
            </div>
          ))}
        </div>
        <button className="reset-btn" onClick={() => setIsDictionaryOpen(false)}>
          Закрыть
        </button>
      </div>
    </div>
  );


  return (
    <div className="game-container">
      <header className="jordle-header">
        <h1>JORDLE</h1>
        <button className="dict-button" onClick={() => setIsDictionaryOpen(true)}>
            Словарь 📚
        </button>
        <p className="subtitle">Угадай жаргонизм за 6 попыток</p>
      </header>

      {/* Сообщение об ошибке */}
      {errorMessage && <div className="error-message">{errorMessage}</div>}

      {/* Сетка игры */}
      <div className="grid">
        {[...Array(6)].map((_, rowIndex) => {
          const attempt = history[rowIndex];
          const isCurrentRow = rowIndex === history.length;
          
          return (
            <div key={rowIndex} className="row">
              {[...Array(5)].map((_, colIndex) => {
                // ... (логика ячеек без изменений)
                let char = '';
                let statusClass = '';

                if (attempt) {
                  char = attempt.word[colIndex];
                  const maskVal = attempt.mask[colIndex];
                  if (maskVal === 2) statusClass = 'green';
                  else if (maskVal === 1) statusClass = 'yellow';
                  else statusClass = 'grey';
                } else if (isCurrentRow) {
                  char = currentGuess[colIndex] || '';
                  if (char) statusClass = 'active-input';
                }

                return (
                  <div key={colIndex} className={`cell ${statusClass}`}>
                    {char}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="keyboard">
        {KEYBOARD_ROWS.map((row, rowIndex) => (
          <div key={rowIndex} className="keyboard-row">
            {row.map((key) => (
              <button
                key={key}
                className={`key ${keyboardStatus[key] || 'special-key'}`}
                onClick={() => handleKeyClick(key)}
                disabled={isGameOver || isDictionaryOpen}
              >
                {key}
              </button>
            ))}
          </div>
        ))}
      </div>


      {/* Карточка результата */}
      {isGameOver && solution && (
        <div className="result-modal">
          <div className="result-content">
            <h2>{solution.word}</h2>
            <p className="definition">{solution.desc}</p>
            <button className="reset-btn" onClick={() => reloadGame(false)}> 
              Сыграть ещё
            </button>
          </div>
        </div>
      )}

      {/* Модальное окно словаря */}
      {isDictionaryOpen && <DictionaryModal />}
    </div>
  );
}

export default App;
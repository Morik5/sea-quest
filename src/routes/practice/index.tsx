import { component$, useStyles$ } from '@builder.io/qwik';
import { Link } from '@builder.io/qwik-city';
import styles from './index.css?inline';

const Practice = component$(() => {

  useStyles$(styles);
  
  return (
    <div class="practice-container">
      <main class="practice-main-content">
        <div class="practice-bubble-container">
            <Link href="./vocabulary" class="practice-menu-item" data-text="Vocabulary">
            <span class="bubble-highlight"></span>
            <div class="bubble-text">Vocabulary</div>  
            </Link>
            <Link href="./letterhunt" class="practice-menu-item" data-text="Letter Hunt">
            <span class="bubble-highlight"></span>
            <div class="bubble-text">Letter hunt</div>
            </Link>
            <Link href="./sentences" class="practice-menu-item" data-text="Sentences">
            <span class="bubble-highlight"></span>
            <div class="bubble-text">Sentences</div>
            </Link>
        </div>
      </main>
    </div>
  );
});

export default Practice;

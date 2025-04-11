import { component$ } from '@builder.io/qwik';

export const Button = component$(() => {
    return (
      <button onClick$={() => alert('Ahoj!')}>
        Klikni pro pozdrav
      </button>
    );
  });

  
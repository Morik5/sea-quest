import { component$, Slot } from '@builder.io/qwik';

export const SectionLayout = component$(({ title }: { title: string }) => {
  return (
    <div class="section-container">
      <h1>{title}</h1>
      <div class="section-content">
        <Slot />
      </div>
    </div>
  );
});

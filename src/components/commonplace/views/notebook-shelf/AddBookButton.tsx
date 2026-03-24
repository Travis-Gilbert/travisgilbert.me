'use client';

/**
 * AddBookButton: dashed outline placeholder that triggers the create notebook flow.
 */

interface AddBookButtonProps {
  onClick: () => void;
}

export default function AddBookButton({ onClick }: AddBookButtonProps) {
  return (
    <button
      type="button"
      className="cp-bookshelf-add"
      onClick={onClick}
      aria-label="Create new notebook"
    >
      <span>+</span>
    </button>
  );
}

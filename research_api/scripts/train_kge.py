#!/usr/bin/env python3
"""
KGE Training Pipeline: RotatE embeddings for CommonPlace knowledge graph.

Reads triples exported by `python manage.py export_kge_triples` and trains
a RotatE model via PyKEEN. Outputs entity embeddings in the format expected
by vector_store.KGEStore:

  kge_embeddings/entity_embeddings.npy   (float32 array, shape [n_entities, dim])
  kge_embeddings/entity_to_idx.json      (sha_hash -> row index mapping)
  kge_embeddings/training_metadata.json  (model, epochs, dim, loss, date)

Usage:
  # 1. Export triples from Django
  python manage.py export_kge_triples

  # 2. Train embeddings (this script)
  python scripts/train_kge.py
  python scripts/train_kge.py --dim 128 --epochs 200
  python scripts/train_kge.py --input-dir kge_embeddings --output-dir kge_embeddings

Requirements:
  pip install pykeen torch numpy

The script is standalone (no Django dependency) so it can run in a GPU
environment or CI pipeline separate from the Django application server.
"""

import argparse
import json
import logging
import sys
import time
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
)
logger = logging.getLogger(__name__)


def load_triples(input_dir: Path) -> list[tuple[str, str, str]]:
    """Load (head, relation, tail) triples from TSV exported by export_kge_triples."""
    triples_path = input_dir / 'triples.tsv'
    if not triples_path.exists():
        logger.error('triples.tsv not found in %s', input_dir)
        logger.error('Run: python manage.py export_kge_triples --output-dir %s', input_dir)
        sys.exit(1)

    triples = []
    with open(triples_path) as f:
        header = f.readline()  # skip header
        if not header.startswith('head'):
            logger.warning('Unexpected header in triples.tsv: %s', header.strip())
        for line in f:
            parts = line.strip().split('\t')
            if len(parts) == 3:
                triples.append(tuple(parts))

    logger.info('Loaded %d triples from %s', len(triples), triples_path)
    return triples


def train_rotate(
    triples: list[tuple[str, str, str]],
    embedding_dim: int = 64,
    num_epochs: int = 100,
    learning_rate: float = 0.01,
    batch_size: int = 256,
    negative_samples: int = 32,
) -> dict:
    """
    Train a RotatE model on the given triples using PyKEEN.

    RotatE models relations as rotations in complex space, which captures
    symmetry, antisymmetry, inversion, and composition patterns well.
    Good fit for a knowledge graph with typed edges (shared_entity,
    shared_topic, semantic, etc.).

    Returns dict with 'model', 'training_result', and 'triples_factory'.
    """
    try:
        from pykeen.pipeline import pipeline
        from pykeen.triples import TriplesFactory
        import torch
    except ImportError as exc:
        logger.error('Missing dependency: %s', exc)
        logger.error('Install with: pip install pykeen torch')
        sys.exit(1)

    # Build triples factory from raw string triples
    tf = TriplesFactory.from_labeled_triples(
        triples=__import__('numpy').array(triples, dtype=str),
    )

    logger.info(
        'Triples factory: %d entities, %d relations, %d triples',
        tf.num_entities, tf.num_relations, tf.num_triples,
    )

    if tf.num_triples < 10:
        logger.warning(
            'Very few triples (%d). Model quality will be poor. '
            'Add more edges before training.',
            tf.num_triples,
        )

    # Use 90/10 train/test split
    training, testing = tf.split([0.9, 0.1], random_state=42)

    result = pipeline(
        training=training,
        testing=testing,
        model='RotatE',
        model_kwargs={'embedding_dim': embedding_dim},
        optimizer='Adam',
        optimizer_kwargs={'lr': learning_rate},
        training_kwargs={
            'num_epochs': num_epochs,
            'batch_size': min(batch_size, max(32, tf.num_triples // 4)),
        },
        negative_sampler_kwargs={'num_negs_per_pos': negative_samples},
        random_seed=42,
        use_tqdm=True,
    )

    return {
        'model': result.model,
        'training_result': result,
        'triples_factory': tf,
    }


def export_embeddings(
    result: dict,
    output_dir: Path,
    embedding_dim: int,
    num_epochs: int,
    training_time: float,
) -> None:
    """
    Extract entity embeddings from the trained RotatE model and save to disk.

    RotatE uses complex embeddings (real + imaginary parts). We concatenate
    them into a single real-valued vector per entity for compatibility with
    the dot-product similarity search in KGEStore.
    """
    import numpy as np

    model = result['model']
    tf = result['triples_factory']

    output_dir.mkdir(parents=True, exist_ok=True)

    # Extract entity embedding tensor
    entity_repr = model.entity_representations[0]
    embeddings_tensor = entity_repr(indices=None).detach().cpu()

    # RotatE stores complex embeddings as [real, imag] concatenated
    embeddings_np = embeddings_tensor.numpy().astype('float32')

    logger.info('Embedding shape: %s', embeddings_np.shape)

    # Build entity_to_idx mapping (sha_hash -> row index)
    entity_to_idx = {}
    for entity_label, idx in tf.entity_to_id.items():
        entity_to_idx[entity_label] = int(idx)

    # Save embeddings
    emb_path = output_dir / 'entity_embeddings.npy'
    np.save(emb_path, embeddings_np)
    logger.info('Saved embeddings to %s', emb_path)

    # Save entity index
    idx_path = output_dir / 'entity_to_idx.json'
    with open(idx_path, 'w') as f:
        json.dump(entity_to_idx, f, indent=2)
    logger.info('Saved entity index (%d entities) to %s', len(entity_to_idx), idx_path)

    # Save training metadata
    losses = result['training_result'].losses
    final_loss = float(losses[-1]) if losses else None

    metadata = {
        'model': 'RotatE',
        'embedding_dim': embedding_dim,
        'effective_vector_dim': embeddings_np.shape[1],
        'num_entities': len(entity_to_idx),
        'num_epochs': num_epochs,
        'final_loss': final_loss,
        'training_time_seconds': round(training_time, 2),
        'trained_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
    }

    meta_path = output_dir / 'training_metadata.json'
    with open(meta_path, 'w') as f:
        json.dump(metadata, f, indent=2)
    logger.info('Saved metadata to %s', meta_path)

    logger.info(
        '\nTraining complete:\n'
        '  Entities     : %d\n'
        '  Vector dim   : %d\n'
        '  Final loss   : %s\n'
        '  Time         : %.1fs\n'
        '  Output       : %s/',
        len(entity_to_idx),
        embeddings_np.shape[1],
        f'{final_loss:.4f}' if final_loss else 'N/A',
        training_time,
        output_dir,
    )


def main():
    parser = argparse.ArgumentParser(
        description='Train RotatE KGE embeddings for CommonPlace knowledge graph.',
    )
    parser.add_argument(
        '--input-dir', type=str, default='kge_embeddings',
        help='Directory containing triples.tsv from export_kge_triples (default: kge_embeddings)',
    )
    parser.add_argument(
        '--output-dir', type=str, default='kge_embeddings',
        help='Directory to write embeddings (default: kge_embeddings)',
    )
    parser.add_argument(
        '--dim', type=int, default=64,
        help='Embedding dimension (default: 64). Higher dims capture more structure but train slower.',
    )
    parser.add_argument(
        '--epochs', type=int, default=100,
        help='Training epochs (default: 100). More epochs can improve quality for larger graphs.',
    )
    parser.add_argument(
        '--lr', type=float, default=0.01,
        help='Learning rate (default: 0.01).',
    )
    parser.add_argument(
        '--batch-size', type=int, default=256,
        help='Training batch size (default: 256). Auto-capped for small graphs.',
    )

    args = parser.parse_args()
    input_dir = Path(args.input_dir)
    output_dir = Path(args.output_dir)

    # Load triples
    triples = load_triples(input_dir)
    if not triples:
        logger.error('No triples found. Nothing to train.')
        sys.exit(1)

    # Train model
    logger.info(
        'Training RotatE (dim=%d, epochs=%d, lr=%s, batch=%d)...',
        args.dim, args.epochs, args.lr, args.batch_size,
    )
    start = time.time()
    result = train_rotate(
        triples=triples,
        embedding_dim=args.dim,
        num_epochs=args.epochs,
        learning_rate=args.lr,
        batch_size=args.batch_size,
    )
    elapsed = time.time() - start

    # Export embeddings
    export_embeddings(
        result=result,
        output_dir=output_dir,
        embedding_dim=args.dim,
        num_epochs=args.epochs,
        training_time=elapsed,
    )

    logger.info(
        '\nDone. Restart the Django server to load new embeddings:\n'
        '  python manage.py runserver 8001'
    )


if __name__ == '__main__':
    main()

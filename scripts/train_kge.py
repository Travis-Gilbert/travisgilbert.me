#!/usr/bin/env python3
"""
KGE (Knowledge Graph Embedding) training script.

Trains a RotatE model on the triple export from export_kge_triples.
Saves entity embeddings as numpy arrays for use by vector_store.py.

Requirements (local/dev only -- not required in production):
  pip install pykeen torch

Usage:
  python scripts/train_kge.py
  python scripts/train_kge.py --input-dir kge_embeddings --epochs 150
  python scripts/train_kge.py --model TransE

RotatE is the default. It handles 1-to-many relations better than TransE
(one Source Object cited by many Notes is ambiguous under TransE's simple
translation -- RotatE's complex-space rotation handles it cleanly).

Output (written to --input-dir):
  entity_embeddings.npy      -- float32 array, shape (n_entities, dim)
  entity_to_idx.json         -- {sha_hash: int} index mapping
  relation_embeddings.npy    -- float32 array, shape (n_relations, dim)
  relation_to_idx.json       -- {relation_name: int} index mapping
  training_metadata.json     -- model name, epochs, loss, training time
"""

import argparse
import json
import os
import time
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description='Train a KGE model on notebook triples.')
    parser.add_argument('--input-dir', default='kge_embeddings', help='Directory with triples.tsv')
    parser.add_argument('--model', default='RotatE', choices=['RotatE', 'TransE', 'ComplEx'])
    parser.add_argument('--epochs', type=int, default=100)
    parser.add_argument('--embedding-dim', type=int, default=128)
    parser.add_argument('--batch-size', type=int, default=512)
    args = parser.parse_args()

    input_dir = Path(args.input_dir)
    triples_path = input_dir / 'triples.tsv'

    if not triples_path.exists():
        print(f'Error: {triples_path} not found.')
        print('Run first:  python manage.py export_kge_triples')
        return

    try:
        import torch
        from pykeen.pipeline import pipeline
        from pykeen.triples import TriplesFactory
        import numpy as np
    except ImportError as exc:
        print(f'Missing dependency: {exc}')
        print('Install with:  pip install pykeen torch')
        return

    print(f'Loading triples from {triples_path}...')

    triples_factory = TriplesFactory.from_path(
        triples_path,
        create_inverse_triples=True,
    )

    n_entities = triples_factory.num_entities
    n_relations = triples_factory.num_relations
    n_triples = triples_factory.num_triples

    print(f'  Entities  : {n_entities}')
    print(f'  Relations : {n_relations}')
    print(f'  Triples   : {n_triples}')
    print(f'\nTraining {args.model} for {args.epochs} epochs...')

    start = time.time()

    result = pipeline(
        training=triples_factory,
        model=args.model,
        model_kwargs=dict(embedding_dim=args.embedding_dim),
        training_kwargs=dict(
            num_epochs=args.epochs,
            batch_size=args.batch_size,
        ),
        evaluation_kwargs=dict(batch_size=args.batch_size),
        random_seed=42,
    )

    elapsed = time.time() - start
    print(f'Training complete in {elapsed:.1f}s')

    # Extract embeddings
    model = result.model
    entity_repr = model.entity_representations[0]
    relation_repr = model.relation_representations[0]

    with torch.no_grad():
        entity_embs = entity_repr(
            torch.arange(n_entities)
        ).cpu().numpy().astype('float32')
        relation_embs = relation_repr(
            torch.arange(n_relations)
        ).cpu().numpy().astype('float32')

    # Save embeddings
    ent_emb_path = input_dir / 'entity_embeddings.npy'
    rel_emb_path = input_dir / 'relation_embeddings.npy'
    np.save(ent_emb_path, entity_embs)
    np.save(rel_emb_path, relation_embs)
    print(f'Saved entity embeddings: {entity_embs.shape} -> {ent_emb_path}')
    print(f'Saved relation embeddings: {relation_embs.shape} -> {rel_emb_path}')

    # Save index maps
    entity_to_idx = {
        ent: int(idx)
        for ent, idx in triples_factory.entity_to_id.items()
    }
    relation_to_idx = {
        rel: int(idx)
        for rel, idx in triples_factory.relation_to_id.items()
    }

    ent_idx_path = input_dir / 'entity_to_idx.json'
    rel_idx_path = input_dir / 'relation_to_idx.json'

    with open(ent_idx_path, 'w') as f:
        json.dump(entity_to_idx, f, indent=2)
    with open(rel_idx_path, 'w') as f:
        json.dump(relation_to_idx, f, indent=2)

    # Save metadata
    metrics = result.metric_results.to_flat_dict() if result.metric_results else {}
    metadata = {
        'model': args.model,
        'epochs': args.epochs,
        'embedding_dim': args.embedding_dim,
        'n_entities': n_entities,
        'n_relations': n_relations,
        'n_triples': n_triples,
        'training_time_seconds': round(elapsed, 1),
        'metrics': {k: round(v, 4) for k, v in metrics.items() if isinstance(v, float)},
    }
    meta_path = input_dir / 'training_metadata.json'
    with open(meta_path, 'w') as f:
        json.dump(metadata, f, indent=2)

    print(f'\nAll files written to {input_dir}/')
    print('\nNext step:')
    print('  The embeddings are loaded automatically by vector_store.py')
    print('  when the Django app starts (via apps.py AppConfig.ready()).')


if __name__ == '__main__':
    main()

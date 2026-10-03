---
title: "A field guide to this site's markdown"
date: 2026-10-02
description: "Every markdown feature this site renders, in one place: math, code, tables, links, images and callouts."
tags: [meta]
---

Notes here are written in Obsidian and published as they are. This page is the reference: each section shows one family of features, rendered exactly as an essay would render it.

## Math

Inline math sits inside a sentence, like the exponential survival function $P(X > t) = e^{-\lambda t}$ or a rate $\lambda > 0$. Display math gets its own line:

$$
P(X > s + t \mid X > s) = \frac{P(X > s + t)}{P(X > s)} = \frac{e^{-\lambda (s + t)}}{e^{-\lambda s}} = e^{-\lambda t} = P(X > t)
$$

A deliberately wide equation scrolls inside its own box instead of stretching the page:

$$
\sum_{n=0}^{\infty} \frac{(\lambda t)^n e^{-\lambda t}}{n!} = e^{-\lambda t} \left( 1 + \lambda t + \frac{(\lambda t)^2}{2!} + \frac{(\lambda t)^3}{3!} + \frac{(\lambda t)^4}{4!} + \frac{(\lambda t)^5}{5!} + \frac{(\lambda t)^6}{6!} + \cdots \right) = 1
$$

## Code

Fenced blocks are highlighted at build time:

```ts
/** The probability that an exponential wait outlasts `t`. */
export function survival(rate: number, t: number): number {
  if (rate <= 0) throw new RangeError('rate must be positive');
  return Math.exp(-rate * t);
}
```

Long lines scroll sideways within the block:

```ts
const longLine = ['memorylessness', 'exponential', 'geometric', 'survival', 'hazard', 'rate', 'waiting', 'time', 'renewal', 'process', 'poisson', 'arrival', 'interarrival', 'queue', 'markov', 'chain'].join(' ');
```

## Tables and lists

| Distribution | Support | Memoryless |
| --- | --- | --- |
| Exponential | $[0, \infty)$ | Yes |
| Geometric | $\{1, 2, 3, \dots\}$ | Yes |
| Normal | $\mathbb{R}$ | No |

A task list:

- [x] Write the field guide
- [ ] Finish the essay

Footnotes collect at the end of the page.[^1]

[^1]: Like this one, with a link back to where it was cited.

## Links and images

Wikilinks resolve to other notes by file name: [[memorylessness]] uses the note's title, and [[memorylessness|an aliased link]] uses its own text.

Images live in the attachments folder and can be given a width:

![[garden-tile.svg|A low-poly grass block|160]]

## Callouts

> [!note]
> A plain callout sets a remark apart from the text around it.

> [!tip]- A folded tip
> Foldable callouts start closed when written with a minus sign.

> [!warning]+ An open warning
> A plus sign makes a foldable callout that starts open.

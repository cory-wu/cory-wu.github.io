---
title: The Experiential Landscape
---

Tell me everything about you, and your disposition. I want to hear about what you were like since the moment you were born. Everything you have ever seen, every move you've made, everything about your health, your genetic makeup, *everything*. It's all important to me.

Now tell me about your world. I want to know about the apartment you grew up in. About the weeping willow you and your sister used to tell stories under. Everything about the schools you attended, your friends, your work, your parents, *share it all*. I'm listening.

I want to build our experiential landscape.

---

## Introduction

The **experiential landscape** is a little thought experiment, inspired by Bayesian principles in statistics and reinforcement learning. It goes a little something like this: 

Everything you've ever done in your life has led to this very moment. There was a single trajectory guided by every decision you've made and every person you've chosen to befriend. A little red string, if you will. Everything out of your control was decided by the state of your world--your parents, your hometown, your schooling.

What you, at this very moment, choose to do or not do thus decides everything that is yet to come, given that you know what's going on in your world. What do you choose to do next, and  how do you move your trajectory forward? Don't forget that you had to get to where you are somehow. What choices did you make to bring you here?

Follow the red string back to the moment you were born. The first few years of your life were (probabilistically) determined by the choices of your parents. They unraveled your red string for you, according to what they thought was best (or what they could do). Then, when you were a little older, you too could push your life forward. You learned to tie your shoes, practice your times tables, and read books. You built habits, developed a bedtime routine, and grew up.

The way that our lives unfold, how our red strings unravel, is out of our control. But we follow patterns--probability distributions over our decisions--that make us who we are. We ask ourselves: "What would Dad do in this scenario?" or "How might I have turned out if I hadn't learned an instrument?" These questions dig at the idea of alternate timelines that describe other lives you could have lived, or other lives that other people could have lived. *That* is the experiential landscape; **it is the set of all possible human experiences in which our own lives fall on and travel around, looping about and intersecting with others.**

---

This idea is fascinating to me. *The set of all possible human experiences.* It's quite literally everything I could possibly imagine. In the rest of this piece I want to explore this idea further and dive into some of its eerily beautiful implications. I'll start with a statistical formalization to help probe some ideas hiding behind the landscape, then discuss other thoughts I have about the experiential landscape.

## A Formalization of the Landscape

For simplicity, let's assume we live life in discrete time. I'm pretty sure the math here can be generalized to continuous-time models, but I'm not going to do that here.

### Trajectories and the landscape itself

Let time be indexed by $t \in \{0,1,2,\dots\}$. At each time $t$, a person occupies some experiential state
$$
x_t \in \mathcal{X},
$$
where $x_t$ summarizes where a person is at in life. This includes health, skills, relationships, habits, beliefs, memories, and other latent features relevant to future development. We can think of life as a trajectory
$$
\tau = (x_0, x_1, x_2, \dots)
$$
through the *experiential landscape* $\mathcal{X}$. 

Now consider 
$$
h_t = (x_0, x_1, \ldots, x_t),
$$
which denotes the full history of experience up to time $t$. The core Bayesian idea is that, conditioned on this history, there is a distribution over possible futures:
$$
p(x_{t+1:\infty} \mid h_t).
$$
This distribution represents the set of all ways a life could unfold from the present moment onward, given everything that has happened so far. In this sense, the experiential landscape is not just the set of possible states, but the set of possible trajectories together with the probability structure induced by past experience.

### Actions and World Dynamics

To distinguish personal choice from external circumstance, let us write the next state as depending on both an action or decision $a_t \in \mathcal{A}$ and a world state/external context $w_t \in \mathcal{W}$. Then we can imagine transitions of the form
$$
x_{t+1} \sim p(\cdot \mid x_t, a_t, w_t).
$$
Here, $x_t$ captures who/where you are (in life) now, $a_t$ captures what you choose to do at this moment, and $w_t$ describes what the world presents to you. The transition kernel $p$ describes how these combine to shape the next step in your life, though the exact form of this is not important.

The idea here is that people don't choose their entire future directly; rather, their future is determined locally, and those local choices push them into regions of the experiential landscape from which different futures become more or less likely. As a quick example, we can imagine that some arbitrary decision $\tilde a_t$ which says "save all of the money you currently have and spend as little as possible moving forward" would push a person abiding this rule to grow their wealth, literally affording a different life than someone whose decision rule $\tilde a'_t$ says to spend their money however they please.

### The Bayesian Update

We can say that at time $t$, given a history $h_t = (x_0, \dots, x_t)$, we have an idea of what comes next:
$$
p(x_{t+1} \mid h_t).
$$
This tries to answer the question: "If I am this kind of person now (based on everything up until today), what kind of person will I be tomorrow?" 

We can extend this to include information about our action $a_t$:
$$
p(x_{t+1} \mid h_t, a_t),
$$
which changes the question at hand to: "If I am this kind of person now (based on everything up until today) *and* I do this certain action today, what kind of person will I be tomorrow?"


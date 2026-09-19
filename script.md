# Use AI and Keep Your CISO Happy: Zero Static Secrets with OIDC and the Operator Pattern

## AI Agents and the new challenge

Not so long ago, most of us designed identity and authorization for a relatively manageable set of actors: developers building and troubleshooting applications, services running in different environments, and CI/CD pipelines deploying them: **the actors were known and their behavior was relatively predictable**.

Now we have a new kind of actor: _autonomous AI agents_.

By autonomous, I mean agents that can plan, invoke tools, delegate work to other agents, and continue operating without asking for approval at every step.

And this is actually incredibly useful: When I investigate an incident, for example, one of the first things I can do is ask agents to analyze CloudWatch metrics and Honeycomb logs while I focus on forming and testing hypotheses.

But to do that work, those agents need access.

I want an agent to inspect a dashboard, but I don’t want it to tear down production. I may want it to query logs during an incident, but I don’t want it to retain that access afterward.

And I cannot safely assume that every model, tool, plugin, or subprocess will handle a reusable credential correctly. That credential could appear in a log, enter model context, be written to memory, or accidentally end up in a repository.

Sandboxes and least-privilege secrets help. But manually creating and distributing credentials for every agent, task, and environment does not scale—especially when hundreds of people across an organization are adopting these tools.

--
The security incident from [@@TODO INSERT DATE@@] and the ever increasing security risks exposed by LLMs exposes that the question is no longer if your CI pipeline will encounter a compromised dependency, but what is exposed when it does.

At Pulumi, we asked ourselves that question and decided the answer should be “nothing useful.” and we eliminate long lived CI secrets across more than 70 repos, but that's not the end of the story, we also need to tie access with intent

We need to make sure each actor, and agents in particular only have the access they need following the least-privilege principle for the time they need.

--

## The problem with static secrets

## Enter short-live secrets and OIDC

The solution I´ll present and the one we are currently using relies on open standards that you can use right now: OIDC.

OIDC is not new, it allows a service to request access to another service via a trust relationship. When that's stablished, the actor will receive a token that grants them the access they need only for the time they need. That token carries identity and authorization, so each operation performed is trazable

## Challenge: What if OIDC Is not available?

Not every service supports OIDC.

AUDIT

ROTATE!

## The operator pattern and The External Secrets Operator

Enough theory, lets put this in action.

The secret sauce for Kubernetes is the operators pattern. We used the awesome "External Secrets Operator" to connect to Pulumi ESC, our secret manager that supports dynamic secrets from multiple sources and through OIDC allows us to mint credentials for service providers. 

SecretStore

ExternalSecret

ESC Environment

Application


Now our cluster stores no secrets at all, if any secret gets compromised we have not only minimized the blast radius of the attack but also the time is contained as the secret is eithersshort lived or will soon be rotated.

## Conclusion

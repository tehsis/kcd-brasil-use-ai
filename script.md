# Use AI and Keep Your CISO Happy: Zero Static Secrets with OIDC and the Operator Pattern

## Introduction

Hi, I'm Pablo Terradillos, I'm from Argentina,  I have been working as a software developer for quite some time now, mostly focused on Developer Experience and Security and currently I am managing the Cloud team at Pulumi where we work to make infranstructure management simpler and secure for everyone.

On this presentation I'm going to talk about how to use AI and keep your CISO or whoever cares about security and compliance in your company happy... while being more confident when delegating tasks to AI agents in general.

## AI Agents and the new challenge

Let me start by setting up a common ground for the new challenges we observed.

Today or I would say not so long ago we designed identity and access control for a well known and relatively manageable set of actors: an Engineer working on his workstation, maybe with access to some shared resources, a set of automated yet predictable CI / CD pipelines than run tests or verify gates before modifying a production environment and the services that composed our application that in turn might need access to third party services as well. And everything automated run on a schedule or in response to a trigger event. Life was simple, wasn't it?

And now we have a new kind of actor: _autonomous AI agents_. Which we can think of them as a combination of all of the previous. We can have agents assisting us when developing a new feature, reviewing a pull request when is created, analizing a failure in our CI/CD pipeline and even propose (and why not, execute) a fix and even interacting wiht our users.

And this sounds... amazing? a little bit scary? maybe a combination right? it is surely tempting to just unleash a swarm of agents over every step of the lifecycle of my application... and then find out that some agent decided to wipe out your production database... at least it wrote an apology... that's something.

We can surely not just rely each agent or harness will do "the right thing" even if asked. In the same way you wouldn't just give production access to any inidividual in your organization.

Last but not least, worth mentioning than the release of "smarter models" and the natural evolution in the usage of these tools has recently exposed new and innovative security vulnerabilities at a pace that is just harder and harder to keep up. We can just expect this kinds of sophisticated attacks to increase.

For good or bad, agents tends to just make their way on what they need.

In summary, If an agent is allowed to do something, you must assume they will do it.

And because of that, long lived static credentials are a problem more than ever: if an agent is ivestigating a production issue, they might just attempt to push the changes. If they have a valid credential available to do so, why not? Accountability is also more important than ever. As an Engineer you can't just blame the tool you are using right? "Oh, sorry our customer data was wiped out because my agent wrote to production instead to my development environment"won't sound great in a postmortem, right?. If all you have for your users or workloads are static secrets, you can't just trace down the access to the agents they might be spawning.

The approach I'm sharing here to address these concerns is to rely on dynamic credentials: issued on demand so the agent can access them when needed. The resulting credential should of course follow the least access principle, only allowing the agent to do what it was asked to do and nothing more and only through the time it need to perform the task.
And they need to be auditable, It should be clear not just what spawn a particular agent but the agent or the workload itself.

I'll show you a practical example of how we addrssed these concerns in my organization as well as the tools and protocols we used to accomplish the endeavor.

While I will be talking about the specific tools we are using, all the concepts are applicable to just any stack.

I'll go in detail, but as a quick overview, these are:

Pulumi, an OSS infrastructure as code solution that allows to define cloud resources using any programming language.
Pulumi ESC as centralized secrets and configuration management. 
OIDC which is an identity protocol that enable services and applications to verify identities
and Extenal Secrets Operator which is a kubernetes operator that synchronizes secrets from external providers.

alright, lets go

--

## Chapter One: Elminating static secrets on CI

The first chapter of this journey starts in CI. We wantted to get rid of static secrets everywhere. Our first step was to eliminate them in Github Actions, which is what we use for Continous integration.

This story is covered in detail on a very nice blogpost from my teammate Boris, so I'll invite you to take a look at it.

But is the foundational stone for everything that comes after. Since all the requirements for AI agents are also true in CI since now you have agents working on your CI pipelines as well and because of the security challengs I mentioned before.

Here we used OpenID Connect (also known as OIDC) which is an authentication standard that lets you sign in to a service using your account from another service and Pulumi ESC to centralize the credentials management.

In this particular example, a github action authenticates to Pulumi ESC via OIDC, the github action requests to open a particular ESC Environment which in turn also uses OIDC now to exchange credentials to the specific cloud provider. 
To understand this better, let me tell you a bit about Pulumi ESC and how this whole thing is setup.

With ESC, you can define environments to expose configuration and secrets. So you can have different environments that store or are able to fetch its own set of dynamic credentials and compose those environments as needed. On this diagram you can see an environment that provides S3 read only credentials, another wone with write credentials for Azure Blob storage and they are composed into a new environment that is able to provide credentials to our users or workloads read from s3 and write to blob storage.

In order for ESC to exchange credentials with another service via OIDC, you need to setup a trust relationship. Each environment can get their own identity. for AWS that means setting up an identity provider that has a role that "trust" our environment via the OIDC claims issued by pulumi. This setup is repepetitve one and we relied on Pulumi Infrastructure as code solution to automate it and make it scalable to many workloads. 

This is what an environment definition in ESC looks like. In this case I am defining a _login_ property for aws that specifies which role this environment will assume when authenticating via OIDC with AWS. You can see the role identifier and also the duration requested for the resulting token. The trust relationship previously setup on AWS will validate those assertions and giving the environment a credential that assumes that role in exchange.

And This is an example of how that composition looks like. Is just another environment definition that imports the other environments.

Of course you can do this without ESC, OIDC is an open standard and are plenty of open source libraries that will allow you to manage the relationship. The power comes through composition. I can define other environments, that reuses this definitions and extend it with additional roles or configuration.


As a result, we have no credentials at all stored on github, we get access to our ESC Environments through the pulumi token exchanged by github which in turns delivers the requested credentials that were exchanged by ESC.

If anything gets exposed at this point, the blast radious is contained and we are able to use the audit trail to trace down which action was compromised.

You can also add special alerts for when a particular environment is being accessed or modified for extra control.


## Step Two: Making it personal

These whole setup can also be extended to engineers workstation and the agents they might spawn.

I can also invoke an environment with special cli command `pulumi env run <environment-name> -- opencode` and my agent will get a credentials set that only grant it access to specific operations on specific resources.

This is a very simple example I made up to keep it short, on the left you can see I ask opencode to list my s3 buckets, something it can make without problems but then it just fails trying to create a bucket. On the right is the opposite, it can not read but it can create the bucket.

Thanks to Pulumi ESC composaibility you can have spawn agent sessions for specific tasks, for example, you can define an environment with access to cloudwatch and datadog to assist you during an incident response and just let it run without even worrying for the agent to take down your production environment while not having to manually approve every action. And since this set of credentials correlates with a single Environment Open on ESC, you can assume they are only valid for this session (a new open will deliver a new set of credentials) All activities on environments are audited, so I can see which environments were accessed to corelate them to the specific agents I have spawn.

This is of course possible because our agents have a single place to look for secrets, all the best practices for secrets management still applies, if you let a secret dangling on a plaintext file, the agent might still use it. As I have said before, when modeling your security policy, assume the agent will do whatever they can do.


## Using Dynamic credentials with Kubernetes

Alright, I hope at this point you are thinking: this is all great, but me and my agents manage kubernetes workloads, How do I use dynamic credentials with my already automated clusters?

Well, that's what the Operator Pattern is for.

The operator pattern automates managing an application using custom resources and a controller. The controller continuously compares the desired state with the actual state and makes changes to reconcile them.

And turns out there's this awesome External Secrets Operator that allow us to use this pattern with secrets! You can use it out of the box with Pulumi ESC but also with other secrets managers such as AWS Secrets Manager or Hashicorp Vault.

All you need to do is define one or many secret stores, which in our case corresponds to the ESC Environment where the credentials are defined and the external secrets we need. These will translate to kubernetes secrets that we can use on our application. The operator will automatically handle renewals based on the specified refresh interval.

We had to setup a trust relationship between each of the clusters and ESC so the cluster itself authenticates through OIDC, in the examples I provided tho I took the liberty here to use a static secret to make it simpler.
On the real world scenario the trust relationship should be automated as well with Pulumi or your prefered infrastructure as code solution.

You need to make sure the pods are recreated when a secret change. Again I have kept it simple here but you need to make sure the pods are recreated to take up the new secrets when they are closer to expire.

Again, here's a very simple example using the environment we defined before that will just use the aws cli to list our buckets.

Of course, these were examples simplified to prove the point. In reald world scenarios or production workloads you also want to setup an OIDC trust relationship between your Kubernetes cluster and Pulumi to avoid storing that token. For development environments this is a safe compromise tho as the pods are not able to access this secret anyway. And is a bit challenge to setup an oidc trust relationship on local workstations.

You might have noticed as well that I have not used any mean for the pods to pick up new secrets on rotation. Again this might be fine for development environment that are ephemeral and the pods will eventually rotate, but for long lived environments you use Stakater to make sure the new secrets are use.

## challenges

Up to here, I assume we all agree that OIDC and dynamic credentials are great. But I do want to share some challenges we faced and propose some solutions.

First of all, dynamic credentials are not free. They surely adds complexity to the setup: you need to make sure each agent you spawn has access to what they need and possibly provide an "elevation proccess". 

Infrastructure as code is a very important tool to address these pains, specially when you have to maintain multiple environments or provision access for new actors.

Second and even more challenging, OIDC is not available everywhere. Sure is well spread, but in the real world you also have to deal with legacy systems or in house solutions that might not be as complete as we expect. There are services as well that might provide OIDC but not support for scoped roles.

The principles described at the beggining still applies of course. I certainly recommend in these cases to leverage a secrets manager for storing these credentials, narrow down who can access them and setup proper rotation policies. Having multiple environments help in this case of course. In Pulumi we use "Review stacks" that are automatically created on every pull request or by demand, so normally most of our coding agents operate against these environments which also allow us to perform manual testing on the results. This of course won't aliveate all the issues magically but allows you to keep all your concerns around secrets on a single place at least and implement custom solutions in the worst case scenario.

Last but not least, re emphazasing what I said at the begining, agents will use whatever they can.
If you have a credential on a text file for example, they might read it an use it.
Commands can be used a escape hatch as well. In our case, if the agent can access the pulumi cli, they can just use your session token to fetch other environments you have access for additional access. Sandboxes with limited commands can help here. My recommendation is to adopt them progresevily restricting access first until you are sure the security model is complete. If possible use a sandbox.

## To summarize

We want agents to do more and more useful work but we need to make sure we do not loose accountability.

Embrace dynamic credentials and eliminate or at least contain long lived credentials.


That's the approach we have been building at Pulumi across our mulitple pipelines, coding agents, and production clusters.

## Questions

I'm not sure how much time we have for questions but please, don't be shy and lets talk about security in the ai era. I'm pretty sure we all have learnings and challenges to share and I'm very excited to learn which challenges you have faced in your own systems.

Thank you!

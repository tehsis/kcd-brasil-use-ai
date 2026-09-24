# Use AI and Keep Your CISO Happy: Zero Static Secrets with OIDC and the Operator Pattern

## Introduction

Hi, I'm Pablo Terradillos, I'm from Argentina, software developer focused on developer tools landscape and security in particular.

I'm going to talk about how to keep AI and keep your CISO happy... and being a little more confident when delegating tasks to AI agents in general.

## AI Agents and the new challenge

Not so long ago, most of us designed identity and authorization for a relatively manageable set of actors: developers building and troubleshooting applications, services running in different environments, and CI/CD pipelines deploying them: **the actors were known and their behavior was relatively predictable**.

Now we have a new kind of actor: _autonomous AI agents_. Which we can think of them as a combination of all them.

They can plan, invoke tools, delegate work to other agents, and continue operating without asking for approval at every step.

And this is actually super useful, we can have many agents doing many different tasks as once, each of them working on with different contexts: developing a new feature, investigating a security incident, doing research, fixing a bug on our code or on our pipelines, messing things up equally across different environments, etc. And these agents can be controlled by developers or being invoked as part of our pipelines like for doing code review or even by our services themselves... so we are actually growing exponentially the number of actors not simply adding a new one.

The challenge is that you need to be able to manage what they can access and when and make sure they can not access anything else... but that really depends on the task you gave to them. If I have an agent managing infranstructure with Pulumi or Terraform, I might want this agent to being able to deploy on a development environment but also require an explicit approval before moving to production.

And we cannot safely assume that every model, tool, plugin, or subprocess will handle a reusable credential correctly. That credential could appear in a log, enter model context, be written to memory, or accidentally end up in a repository.... all the challenges we already had actually now have just exploded.

In addition to all of this, last May, there was this security incident where the atackers used poisoned tags to land mallicious packages on users pipelines. We can just expect this kinds of sophisticated attacks to increase.

So for every Engineering organization, the question is no longer just how to protect your credentials, but what will be exposed if they exfiltrated.

We made ourselves that question and decided that the answer should be "nothing useful"

--

## Short lived credentials to the rescue

To accomplish that, we need to embrace short lived credentials that follow the least access principle. That is to say, they are only valid for the period of time required to accomplish the specific task and enabling access only to the rrequired resources and nothing else.

In addition to that, we need them to be auditable, so we can understand if anything unexpected happened and making sure they are defined once so we can quickly react if we need to rotate them.

The challenge of course, is that you need to have some way to request these crendentials in a convenient and automated way.

--

## First step, eliminate all static credentials from Github Actions

So our first step was to eliminate all static secrets from github actions which is what we use for CI. We had to get rid of any kind of secret basically across every one of our public and private repos, a story you can read in more detail on this blogpost.

But spoiler alert, we use Pulumi ESC as our secrets manager and dynamic credentials through OpenID Connect.

Now instead of storing secrets, we rely on ESC to exchange an OIDC token with our cloud providers (AWS, Azure, etc) for short lived scoped credentials. And sice Pulumi Cloud is an OIDC provider as well, Github will exchange an OIDC token for the required credentials to access ESC.

No secrets are ever stored in this flow (other than in short memory of course). If any credential gets exfiltrated, the blast radious is really minimal as the credentials only last for the required amount of time.

## Secret defitinion on ESC

in order to use dynamic credentials on ESC, you need to setup a trust relationship with Pulumi service on AWS, and assign a role to the specific environment. When that environment is opened, it will mint an OIDC token that gets exchanged for the required credentials.

You can define as many environments as needed matching different roles, different providers and also compose environments for speficic credentials or configuration, that's the magic of ESC. Althouhg you can of course set up your own OIDC token exchange with a custom service and set up the trust relationship with any service provider.

## Making it personal

As you can see on this definition, I'm setting a special `envrionmentVariables` property on this environment, exposing the exchanged credentials.

So I can also invoke this environment via a special command `pulumi env run <environment-name> -- opencode` and my agent will get a credentials set that only grant it access to specific operations on specific resources.

This is a very simple example I made up to keep it short, on the left you can see I ask opencode to list my s3 buckets, something it can make without problems but then it just fails trying to create a bucket. On the right is the opposite, it can not read but it can create the bucket.

Sorry, I'm terrible at examples, but thanks to Pulumi ESC composaibility you can have spawn agent sessions for specific tasks, for example, you can define an environment with access to cloudwatch and datadog to assist you during an incident response and just let it run without even worrying for the agent to take down your production environment while not having to manually approve every action.


## Using Dynamic credentials with Kubernetes

Alright, I hope at this point you are thinking: this is all great, but me and my agents manage kubernetes workloads, How do I use dynamic credentials with my already automated clusters?

Well, that's what the Operator Pattern is for.

The operator pattern automates managing an application using custom resources and a controller. The controller continuously compares the desired state with the actual state and makes changes to reconcile them.

And turns out there's this awesome External Secrets Operator that allow us to use this pattern with secrets! You can use it out of the box with Pulumi ESC but also with other secrets managers such as AWS Secrets Manager or Hashicorp Vault.

All you need to do is define one or many secret stores, which in our case corresponds to the ESC Environment where the credentials are defined and the external secrets we need. These will translate to kubernetes secrets that we can use on our application. The operator will automatically handle renewals based on the specified refresh interval.

Again, here's a very simple example using the environment we defined before that will just use the aws cli to list our buckets... yes I already ackowledged I'm not very creative with examples.

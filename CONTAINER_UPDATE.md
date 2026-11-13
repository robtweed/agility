# How to Update/Replace the Agility Docker Container

## Background

Most updates for Agility are for its executable logic files.  These reside in the *mapped* directory on the host
file system and, as the name implies, are mapped into the Docker Container.  Such normal updates can therefore be performed
by Agility itself, using its built-in Update function: this copies the latest versions of the files from the Github
repository into the various *mapped* folders/sub-folders.

Occasionally, however, the Agility Docker Container image is updated, eg to update versions of the
components, libraries etc that it uses.  This document describes the process(es) you should follow
to reconfigure your Agility system to use a new Docker container.

## Step 1

Ensure you have the very latest version of Agility installed on your machine.

Use the *Update* menu option in Agility's UI to do this.

## Step 2

Stop Agility using Agility's UI **Stop Agility** button in the *Start/Stop Agility* menu option.

This ensures a clean shutdown and forces a backup snapshot to be taken.

## Step 3

It's a good idea to make a copy of Agility's backup file, just in case anything goes wrong.  This will save
you from re-entering all your configuration data from scratch, and ensure you have as much historical data as possible.

You'll find the backup file in Agility's */mapped/logs* directory.  It's named *agility.bak*, eg:

```console
cp ~/agility/mapped/logs/agility.bak /tmp 
```

The example above would make a copy into your system's /tmp directory.  Modify as appropriate for your system.

## Step 4

Stop the Agility Docker Container.

You'll be able to confirm that it's running by using the *docker ps* command, eg:

```console
$ docker ps

CONTAINER ID   IMAGE     COMMAND                  CREATED        STATUS        PORTS                                       NAMES
d3e3b984b1cb   agility   "/bin/sh -c './start…"   2 months ago   Up 2 months   0.0.0.0:8080->8080/tcp, :::8080->8080/tcp   agility

```

At the very end you can see the Container name.  It should be **agility**

To stop the Container cleanly, you should always use the *stopContainer* script provided in Agility:

```console
cd ~/agility/mapped/docker
./stopContainer
```

## Step 5

The new Docker Container may contain a new version of the database.  To ensure there are no
compatibility issues, it's a good idea to run this next step which deletes the existing database
files.  The database contents will have been backed up into the backup file (that we made a copy of
in an earlier step), so don't worry!

Switch to the */agility* directory and run the *recover* command:

```console
cd ~/agility
./recover
```

## Step 6

It's a good idea to delete your existing Docker Container image to ensure there's no name clashes etc with the
new one.

```console
docker rm agility
docker rmi agility
```

Note that this step is completely safe.  The Docker Container and its image are separate from your data.
The latter is maintained within files in the */mapped* folder and its sub-folders.

## Step 7

You can now install the new Docker Image for Agility.  There are two ways you can do this:

### Using the Pre-Built Container

If you are running on an ARM machine (eg a Raspberry Pi or an Apple Silicon-based Mac such as an M4 Mac Mini)
you can use the pre-built Docker Container that is hosted on Docker Hub:

```console
docker pull rtweed/agility-arm64
```

### Manually Build the Container

Alternatively, you can build the *Agility* Docker Container. You'll need to do this if you are
using an Intel-based or AMD64 system.  To build the Container:

Switch to the *docker* directory and run the *buildContainer* command:

```console
cd ~/agility/mapped/docker
./buildContainer
```

It may take a while - let it run to completion.
Ignore any warning message that you might see at the end of the build procedure.

## Step 8

If the container built successfully, you can now start it with the *runContainer* command. Make
sure you use the correct option below!:

- If you pulled the pre-built Container in the previous step:

```console
cd docker
./runContainer
```

- If you built the Container in the previous step:

```console
./runContainer agility
```

When you start the new container for the first time, it will run a number of initialisation steps,
including rebuilding the database.  It will then be ready for you to begin operating Agility

## That Should be It!

Agility should now be back up and running.  Start up the UI in a browser and check the configuration settings, etc.
They all should be as they were before you shut it down.

eg:

```console
http://192.168.1.100:8080
```

Note that when you first start Agility via the UI, it will recover your system's historical records from SolisCloud.

After that, your SolisCloud data is updated incrementally, every half an hour.


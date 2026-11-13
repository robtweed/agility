# Quick Installation Guide for Raspberry Pi

## Pre-requisites

You must be running a [64-bit version of Linux](https://www.raspberrypi.com/software/operating-systems/#raspberry-pi-os-64-bit) 
on your Raspberry Pi

You will need to use an SD card that is **at least 16Gb in size**.  A 32Gb one is recommended.

## Step 1

Ensure you have Docker installed on your Raspberry Pi.  Here's some useful instructions:

- https://pimylifeup.com/raspberry-pi-docker/

The steps that follow assume that you've configured Docker so that it doesn't require use of the *sudo*
command.  This is normally achieved by running the following command:

```console
sudo usermod -aG docker $USER
```

**NOTE**: You **must** log out and log in again after running this command, or start a new terminal session in 
order for this to take effect.

**NOTE 2**: If you're using Raspberry Pi Desktop, you **must** completely log out from the Desktop and log back in. Simply closing 
and re-opening a terminal window will not be sufficient.

Check that it's worked by running a *docker* command such as:

```console
docker ps
```

If this runs without reporting a permissions error, then you're good to proceed.

## Step 2

Ensure you have *git* installed.  If not, type the following in Terminal

```console
sudo apt install git
```

You'll also need *dos2unix* installed.  If you don't already have it installed:

```console
sudo apt install dos2unix
```



## Step 3

Make sure you're in your home directory, eg:

```console
cd ~
```

## Step 4

Clone the *agility* Repository:

```console
git clone https://github.com/robtweed/agility
```

You'll now have a directory: *~/agility*

## Step 5

Switch to that directory, eg

```console
cd agility
```

## Step 6 

Run the prepare script which will ensure all command files can be executed

```console
source prepare.sh
```

## Step 7

You now have a choice.  

### Pull the Pre-Built Container

If you're using a Raspberry Pi (or any other ARM64-based Linux system),
you can pull a pre-built Docker Container:

```console
docker pull rtweed/agility-arm64
```

### Build the Container

Alternatively, you can build the *Agility* Docker Container. You'll need to do this if you are
using an Intel-based or AMD64 system.  To build the Container:

Switch to the *docker* directory and run the *buildContainer* command:

```console
cd docker
./buildContainer
```

It may take a while - let it run to completion.
Ignore any warning message that you might see at the end of the build procedure.


## Step 8

If the container built successfully, you can now start it with the *runContainer* command:

- If you pulled the pre-built Container in the previous step:

```console
cd docker
./runContainer
```

- If you built the Container in the previous step:

```console
./runContainer agility
```

When you start the container for the first time, it will run a number of initialisation steps and
then it will be ready for you to begin operating Agility

## Step 9

Operating Agility

As far as possible, everything else you need to do works via a web interface.

Open a browser and point it at port 8080 on your Agility server, eg:

```console
http://192.168.1.100:8080
```

Before attempting to start Agility, you'll need to edit its initial default configuration.  It will refuse to start until 
you have a complete set of configuration settings.  Use the Configuration menu options.

When you have everything configured, you can try out Agility: select the *Start/Stop Agility* menu option and click the
*Start Agility* button.

Use the *System/Activity Log* menu option to see what Agility is doing.

## Step 9

Modifying Agility's Behaviour

Pretty much everything that the web interface allows you to change will have an immediate effect on Agility's
behaviour (though you might have to wait until its next cycle of activity to see the effect).  

You shouldn't need to stop and restart Agility.

If you do stop and restart Agility, it will simply carry on from before: no settings or data will be lost.




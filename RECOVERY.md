# How to Recover Agility From a Database Corruption

## Background

Agility includes a database that is used to store and cache its operational data on which it makes all its decisions.

The database installation and configuration is designed to ensure that it can recover from most situations.  In
particular, the database files reside in the */agility/mapped* directory, and are therefore available to the Docker 
Container if it is restarted.

It is recommended, for example, that should you need to stop Agility's Docker Container, you should use the
supplied *./stopContainer* command that you'll find in the */agility/docker* directory.  This should shut things
down in a clean and orederly manner.

There are, however, some circumstances that can corrupt the database: in particular if the server on which the
container loses power, resulting in the container stopping in an uncontrolled way.

You'll know if this happens as Agility will refuse to start properly and operations you make from Agility's web interface
will report failures.

If this happens, Agility provides a quick and simple way to recover your system without losing any significant amoumnts 
of data.

## Behind Agility's Recovery Mechanism

The recovery mechanism makes use of a database backup that you may have noticed Agility making every half hour: at
15 and 45 minutes past each hour.  You'll see this reported in the Activity Log.

The backup file resides in the */agility/mapped/logs* directory and is named *agility.bak*.


## Recovery Steps

If you need to recover your system, follow these steps below:

- Stop the Agility Container, using the *./stopContainer* command.

```console
cd ~/agility/docker
./stopContainer
```

- I recommend that you make a copy of the */agility/mapped/logs/agility.bak* file.  When you restart Agility, it will begin
overwriting the *agility.bak* file every half an hour.  If, for some reason, the recovery process didn't fully work,
you could lose the data needed to recover!  For example:

```console
cd ~/agility/mapped/logs
cp agility.bak agility.bak2
```

- Switch to the */agility* directory and run the *recover* command:

```console
cd ~/agility
./recover
```

- Start up the Container again:

```console
cd ~/agility/docker
./runContainer
```

It will automatically recreate the database and restore the data from the backup

- Start Agility from the Web UI.  The first thing Agility will do is fetch your historic data from SolisCloud.

You should now be fully operational again!


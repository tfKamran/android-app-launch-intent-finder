#! /usr/bin/env node

const shell = require('shelljs');
const fs = require('fs');
const xmlToJSON = require('xml-js');
const chalk = require('chalk');
const { getInstalledPath } = require('get-installed-path')

function main(installedLocation) {
    // Check for input arguments
    if (process.argv.length != 3) {
        console.log(
            "You need to pass in an argument with a path of the APK to be analyzed\n"
            + "\n"
            + "Example:\n"
            + "\n"
            + "\tlaunch-intent-finder workspace/test.apk\n"
            );

        return;
    }

    // Cleanup if required
    deleteIfExists(installedLocation + '/workspace/app.apk');
    deleteIfExists(installedLocation + '/app');
    deleteIfExists(installedLocation + '/workspace/app');

    if (!fs.existsSync(installedLocation + '/workspace')) {
        fs.mkdirSync(installedLocation + '/workspace');
    }

    // Decompile the APK
    shell.cp(process.argv[2], installedLocation + '/workspace/app.apk');
    shell.exec('java -jar ' + installedLocation + '/tools/apktool_2.2.1.jar -f d ' + installedLocation + '/workspace/app.apk');
    shell.mv(shell.pwd() + '/app ', installedLocation + '/workspace/');

    // Look for launch intents
    const manifest = fs.readFileSync(installedLocation + '/workspace/app/AndroidManifest.xml', 'utf-8');

    if (manifest.indexOf('android.intent.category.LAUNCHER') === -1) {
        console.log('No launcher activity found in the provided APK');
        return;
    }

    const manifestJSON = JSON.parse(xmlToJSON.xml2json(manifest));
    const application = manifestJSON.elements[0].elements.filter(element => element.name == 'application')[0];
    const activities = application.elements.filter(element => element.name == 'activity' && element.elements
        && (element.attributes['android:exported'] || isLauncherActivity(element)));

    console.log(getDivider());

    activities.forEach(activity => {
        var activityHeader = chalk.underline('\nActivity') + ': ' + activity.attributes['android:name'];
        const isFoundToBeLauncherActivity = isLauncherActivity(activity);

        if (isFoundToBeLauncherActivity) {
            activityHeader = chalk.hex('#00FF00').bold(activityHeader);
        } else {
            activityHeader = chalk.hex('#E0E000')(activityHeader);
        }

        console.log(activityHeader);

        activity.elements.forEach(intentFilters => {
            console.log('');

            if (intentFilters.elements) {
                intentFilters.elements.forEach(intentFilter => {
                    prettyPrint(intentFilter,  isFoundToBeLauncherActivity);
                });
            }
        });

        console.log('\n' + getDivider());
    });
}

function deleteIfExists(file) {
    if (fs.existsSync(file)) {
        shell.rm('-rf', file);
    }
}

function isLauncherActivity(activity) {
    var isLauncherActivity = false;

    activity.elements.forEach(intentFilters => {
        if (intentFilters.elements) {
            intentFilters.elements.forEach(intentFilter => {
                Object.keys(intentFilter.attributes).forEach(key => {
                    if (intentFilter.attributes[key] === 'android.intent.category.LAUNCHER') {
                        isLauncherActivity = true;
                    }
                });
            });
        }
    });

    return isLauncherActivity;
}

function prettyPrint(intentFilter, isFoundToBeLauncherActivity) {
    var filter = intentFilter.name + ': ';
    var sample = '';

    Object.keys(intentFilter.attributes).forEach(key => {
        filter += key.split(':')[1] + '="' + intentFilter.attributes[key] + '", ';
    });

    if (intentFilter.name == 'data') {
        // console.log(JSON.stringify(intentFilter.attributes));
        sample = chalk.hex('#00E000')('Sample URI: ' + intentFilter.attributes['android:scheme'] + '://' + intentFilter.attributes['android:host']);
    }

    if (isFoundToBeLauncherActivity) {
        filter = chalk.bold(filter);
        sample = chalk.bold(sample);
    }

    console.log(sample ? filter + ' - ' + sample : filter);
}

function getDivider() {
    return chalk.grey('--------------------------------------------------------------------------------------------');
}

getInstalledPath('android-app-launch-intent-finder').then(main);

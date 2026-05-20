/*

 ----------------------------------------------------------------------------
 | Agility: Solar Battery Optimisation against Octopus Agile Tariff          |
 |           specifically for Solis Inverters                                |
 |                                                                           |
 | Copyright (c) 2024-26 MGateway Ltd,                                       |
 | Redhill, Surrey UK.                                                       |
 | All rights reserved.                                                      |
 |                                                                           |
 | https://www.mgateway.com                                                  |
 | Email: rtweed@mgateway.com                                                |
 |                                                                           |
 |                                                                           |
 | Licensed under the Apache License, Version 2.0 (the "License");           |
 | you may not use this file except in compliance with the License.          |
 | You may obtain a copy of the License at                                   |
 |                                                                           |
 |     http://www.apache.org/licenses/LICENSE-2.0                            |
 |                                                                           |
 | Unless required by applicable law or agreed to in writing, software       |
 | distributed under the License is distributed on an "AS IS" BASIS,         |
 | WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.  |
 | See the License for the specific language governing permissions and       |
 |  limitations under the License.                                           |
 ----------------------------------------------------------------------------

 23 April 2026

 */


class Battery {

  constructor(agility) {
    this.config = agility.config.$('battery');
    this.operation = agility.config.$('operation');
    this.logger = agility.logger;
    this.date = agility.date;
    this.solis = agility.solis;
    this.solcast = agility.solcast;
    this.octopus = agility.octopus;
    this.axle = agility.axle;
    this.control = agility.control;
    this.agility = agility;
    let glsdb = agility.glsdb;
    this.chargeHistory = new glsdb.node('agilityChargeHistory');
    this.dischargeHistory = new glsdb.node('agilityDischargeHistory');
    this.chargeDecisionHistory = new glsdb.node('agilityChargeDecisionHistory');
    this.noOfChargeRecordsToKeep = 100;
  }

  get isConfigured() {
    if (!this.config.exists) return false;
    if (!this.config.$('storage').exists) return false;
    return true;
  }

  get levelNow() {
    return this.solis.batteryLevelNow;
  }

  get chargeLimit() {
    if (!this.config.$('chargeLimit').exists) return 95;
    return +this.config.$('chargeLimit').value;
  }

  set chargeLimit(value) {
    this.config.$('chargeLimit').value = value;
  }

  isDischargeControlFlagSet() {
    return this.control.$('discharge').exists;
  }

  setDischargeControlFlag() {
    this.control.$('discharge').value = true;
  }

  unsetDischargeControlFlag() {
    this.control.$('discharge').delete();
  }

  suppressFirstProductionLogic() {
    this.control.$('suppressFirstProductionLogic').value = true;
  }

  unsuppressFirstProductionLogic() {
    this.control.$('suppressFirstProductionLogic').delete();
  }

  isFirstProductionLogicSuppressed() {
    return this.control.$('suppressFirstProductionLogic').exists;
  }

  get percentIncreasePerCharge() {
    if (this.chargeHistory.exists) {
      // calculate average from history
      let _this = this;
      let total = 0;
      let count = 0;
      this.chargeHistory.forEachChildNode(function(timeNode) {
        let data = timeNode.document;
        let start = +data.start;
        if (start < 90) {
          let end = +data.end;
          let startMinute = data.startMinute || 0;
          startMinute = +startMinute;
          if (startMinute > 29) {
            startMinute = startMinute - 30;
          }
          if (start < end && start < _this.chargeLimit) {
            let increase = end - start;
            if (startMinute === 0) {
              total += increase;
            }
            else {
              // scale up increase to what it would have been for 30 minutes
              increase = (increase / (30 - startMinute)) * 30;
              total += increase;
            }
            count++;
          }
        }
      });
      if (total !== 0 && count !== 0) {
        console.log('total: ' + total + '; count: ' + count);
        let ave = total / count;
        console.log('average charge history value: ' + ave.toFixed(2));
        return ave;
      }
    }
    if (this.config.$('defaultPercentIncreasePerCharge').exists) {
      return +this.config.$('defaultPercentIncreasePerCharge').value;
    }
    else {
      return 9;
    }
  }

  get percentDecreasePerDischarge() {
    if (this.dischargeHistory.exists) {
      // calculate average from history
      let _this = this;
      let total = 0;
      let count = 0;
      this.dischargeHistory.forEachChildNode(function(timeNode) {
        let data = timeNode.document;
        let start = +data.start;
        let end = +data.end;
        console.log('start: ' + start + '; end: ' + end);
        if (end > _this.minimumLevel) {
          let startMinute = data.startMinute || 0;
          startMinute = +startMinute;
          if (startMinute > 29) {
            startMinute = startMinute - 30;
          }
          if (start > end) {
            let decrease = start - end;
            if (startMinute === 0) {
              total += decrease;
            }
            else {
              // scale up increase to what it would have been for 30 minutes
              decrease = (decrease / (30 - startMinute)) * 30;
              total += decrease;
            }
            count++;
          }
        }
      });
      if (total !== 0 && count !== 0) {
        console.log('total: ' + total + '; count: ' + count);
        let ave = total / count;
        console.log('average discharge history value: ' + ave.toFixed(2));
        return ave;
      }
    }
    return 9;
  }


  get totalStorage() {
    return +this.config.$('storage').value;
  }

  set totalStorage(value) {
    this.config.$('storage').value = value;
  }

  get minimumLevel() {
    if (!this.config.$('minimumLevel').exists) return 20;
    return +this.config.$('minimumLevel').value;
  }

  set minimumLevel(value) {
    this.config.$('minimumLevel').value = value;
  }

  updateChargeDecisionHistory(positionNow) {
    let now = this.date.now();
    this.chargeDecisionHistory.$([now.dateIndex, now.slotTimeIndex]).document = positionNow;
  }

  getChargeDecisionHistory(dateIndex) {
    let history = {};
    this.chargeDecisionHistory.$(dateIndex).forEachChildNode(function(timeNode) {
      let slot = timeNode.$('slot').value;
      history[slot] = timeNode.document;
    });
    return history;
  }

  get latestChargeDecision() {
    let now = this.date.now();
    let data = this.chargeDecisionHistory.$([now.dateIndex, now.slotTimeIndex]).document;
    return data;
  }

  get calculationCutoffTime() {
    if (!this.octopus.customTariffEnabled) {
      return '22:30';
    }
    let node = this.operation.$('calculationCutoffTime');
    if (!node.exists) return '22:30';
    return node.value;
  }

  set calculationCutoffTime(value) {
    this.operation.$('calculationCutoffTime').value = value;
  }


  netPowerBetween(fromTimeText, toTimeText, override, log) {
    if (typeof log === 'undefined') log = true;

    if (log) this.logger.write('Calculating expected power between ' + fromTimeText + ' and ' + toTimeText);
    let averageExpectedPower;

    if (!override && this.octopus.tomorrowsTariffsAvailable) {
      if (log) this.logger.write('Tomorrows octopus tariff available so get power till ' + toTimeText + ' tomorrow');
      // first get expected power from now until 23:30
      let power1 = this.solis.averagePowerBetween(fromTimeText, '23:50');
      if (log) this.logger.write('Expected power from ' + fromTimeText + ' until 23:50:');
      if (log) this.logger.write(JSON.stringify(power1));
      // then get expected power from midnight until specified to time
      let power2 = this.solis.averagePowerBetween('00:01', toTimeText);
      if (log) this.logger.write('Expected power from midnight until ' + toTimeText + ':');
      if (log) this.logger.write(JSON.stringify(power2));
      averageExpectedPower = {
        load: (+power1.load + +power2.load).toFixed(2),
        pv: (+power1.pv + +power2.pv).toFixed(2),
      }
    }
    else {
      averageExpectedPower = this.solis.averagePowerBetween(fromTimeText, toTimeText);
    }
    if (log) this.logger.write('Expected power use between ' + fromTimeText + ' and ' + toTimeText + ': ')
    if (log) this.logger.write(JSON.stringify(averageExpectedPower));
    let pv = averageExpectedPower.pv;
    if (this.solcast.isEnabled) {
      let spv = this.solcast.expectedPowerBetween(fromTimeText, toTimeText, override, true, log);
      if (spv > 0) pv = spv;
      if (log) this.logger.write('Solcast expected PV during this period: ' + spv);
    }
    let netPower = averageExpectedPower.load - pv;
    return netPower;
  }

  powerFromPercentage(percent) {
    return this.totalStorage * (percent / 100);
  }

  availablePowerFromPercentage(percent) {
    let availablePercentage = percent - this.minimumLevel;
    return this.powerFromPercentage(availablePercentage);
  }

  get availablePowerNow() {
    if (this.levelNow) {
      console.log('battery level now: ' + this.levelNow);
      return +this.availablePowerFromPercentage(this.levelNow);
    }
    console.log('Battery Level unable to be calculated');
    return;
  }

  noOfSlotsToChargeBy(deficit, log) {
    if (typeof log === 'undefined') log = true;
    let increasePerCharge = this.percentIncreasePerCharge;
    if (log) this.logger.write('Each charge will increase battery percentage by ' + increasePerCharge);
    let powerAddedPerCharge =  this.powerFromPercentage(increasePerCharge);
    if (log) this.logger.write('power added per charge: ' + powerAddedPerCharge.toFixed(2));
    let noOfSlots = Math.round(deficit / powerAddedPerCharge);
    if (log) this.logger.write('no of slots needed for deficit of ' + deficit.toFixed(2) + ': ' + noOfSlots);
    return noOfSlots;
  }

  getPowerDeficit(fromTimeText, toTimeText, log) {
    if (typeof log === 'undefined') log = true;
    let override;
    let powerNeeded = this.netPowerBetween(fromTimeText, toTimeText, override, log);
    let batteryLevel = this.levelNow;
    if (!batteryLevel) return 0; // ******* to do
    if (log) this.logger.write('Battery level is currently ' + batteryLevel + '%');
    let availableBatteryPower = this.availablePowerFromPercentage(batteryLevel);
    if (log) this.logger.write('which equates to ' + availableBatteryPower.toFixed(2) + ' kWh of power that can be provided by the battery');
    let powerDeficit = powerNeeded - availableBatteryPower;
    if (log) this.logger.write('Power deficit: ' + powerDeficit.toFixed(2) + ' kWh');
    return powerDeficit;
  }

  noOfSlotsNeeded(powerDeficit) {
    if (powerDeficit <= 0) {
      this.logger.write('Enough power in battery to meet requirements');
      return 0;
    }
    this.control.$('powerSurplus').delete();
    let noOfSlots = this.noOfSlotsToChargeBy(powerDeficit);
    if (noOfSlots === 0) {
      this.logger.write('Enough power in battery to meet requirements');
    }
    else {
      this.logger.write('This requires ' + noOfSlots + ' slots of charging');
    }
    return noOfSlots;
  }

  preProductionChargeCheck(positionNow) {
    let now = this.date.now();
    if (now.hour > 15 && now.hour < 19) return false;

    if (!positionNow.chargingDecision.charge && this.solcast.isEnabled) {
      this.logger.write('No charge - is this before time of first PV production?');

      let firstPVTime = this.solcast.firstProductionTime;
      if (firstPVTime) {
        //this.logger.write('firstPVTime object:');
        //this.logger.write(firstPVTime);
        let firstPVTimeIndex = firstPVTime.timeIndex + this.solis.productionDelay;
        let firstPVTimeText = this.date.at(firstPVTimeIndex).timeText;
        let firstPVTimeToday = this.date.atTime(firstPVTimeText);
        //this.logger.write('now: ' + now.timeIndex + '; ' + now.hour);
        //this.logger.write('firstPVTimeToday: ' + firstPVTimeToday.timeIndex);
        if (now.hour > 18 || now.timeIndex < firstPVTimeToday.timeIndex) {
          // check if logic is to be suppressed due to upcoming always buy slots: if so, return false
          if (this.isFirstProductionLogicSuppressed()) {
            this.logger.write('First Production Logic suppression flag is set, so no further action');
            return false;
          }
          let todayOnly = true;
          if (now.hour > 18) todayOnly = false;
          this.logger.write('Current time is earlier than first PV production today');
          this.logger.write('Get power balance position from now to first PV time: ' + firstPVTimeText);
          this.logger.write('Early PV production will be ignored in this assessment');
          let firstPVPositionNow = this.positionNow(false, firstPVTimeText, todayOnly, true);
          this.logger.write(firstPVPositionNow);
          if (firstPVPositionNow.chargeSlotsNeeded > 0) {
            this.octopus.sortSlots(firstPVTimeText);
            let slots = this.octopus.cheapestSlotArray;
            //this.logger.write('slots');
            //this.logger.write(slots);
            firstPVPositionNow = this.shouldUseSlotToCharge(firstPVPositionNow, slots, true, false);
            this.logger.write('Assessment up to time of first PV Production: ' + firstPVTimeText);
            this.logger.write(firstPVPositionNow);
            return firstPVPositionNow.chargingDecision;
          }
          else {
            this.logger.write('Power surplus, so no charging needed');
            return false;
          }
        }
        else {
          this.logger.write('Current time is later than first PV production today');
          // remove suppression of first production logic (if set) - see shouldBeDischarged()
          this.unsuppressFirstProductionLogic();
          this.logger.write('First Production logic suppression flag has been removed');
          return false;
        }
      }
      else {
        return false;
      }
    }
    else {
      return false;
    }
  }

  get shouldBeCharged() {
    // if previous slot charged battery,save the new battery level
    this.solis.endChargeHistoryRecord();
    //
    // if previous slot discharged battery,save the new battery level
    this.solis.endDischargeHistoryRecord();
    //
    let obj = this.availableSlotsByPrice(true);

    let slots = obj.slots;
    let positionNow = obj.positionNow;

    if (this.isDischargeControlFlagSet()) {
      let reason = 'Manual Discharge control flag has been set';
      this.logger.write(reason);
      positionNow.chargingDecision.reason = reason; 
      this.updateChargeDecisionHistory(positionNow);
      return false;
    }

    // dont charge, reason specified
    if (!positionNow.chargingDecision.charge && positionNow.chargingDecision.reason !== '') {

      // do a pre-production test before committing to a no-charge

      let result = this.preProductionChargeCheck(positionNow);
      if (result && result.charge) {
        positionNow.chargingDecision = result;
      }

      this.logger.write('Charging status: ' + positionNow.chargingDecision.charge);
      this.logger.write(positionNow.chargingDecision.reason);
      this.updateChargeDecisionHistory(positionNow);
      return positionNow.chargingDecision.charge;
    }

    // charge set
    if (positionNow.chargingDecision.charge) {
      this.logger.write('Charging status: ' + positionNow.chargingDecision.charge);
      this.logger.write(positionNow.chargingDecision.reason);
      this.updateChargeDecisionHistory(positionNow);
      return positionNow.chargingDecision.charge;
    }

    // need to spin through cheapest slots to decide whether or not to use current slot for charging

    this.logger.write('=============');
    this.logger.write('Summary position:');
    this.logger.write(positionNow);
    this.logger.write('=============');

    positionNow = this.shouldUseSlotToCharge(positionNow, slots, true);
    if (positionNow.chargingDecision.charge === 'charge') {
      this.agility.setChargingStartedFlag();
    }

    // if not charging set and time is before time of first production (+1 hour)
    //  then reasess positionNow based on time of first production
    //  in order to prevent running down battery level overnight

    let result = this.preProductionChargeCheck(positionNow);
    if (result && result.charge) {
      positionNow.chargingDecision = result;
    }

    this.logger.write('Charging status: ' + positionNow.chargingDecision.charge);
    this.logger.write(positionNow.chargingDecision.reason);
    this.updateChargeDecisionHistory(positionNow);
    return positionNow.chargingDecision.charge;
  }

  get shouldBeDischarged() {

    /*
      New logic:

      Get no of slots needed for battery charging until cutoff horizon: X

      Get no of always-buy slots: Y

      If Y > X, should I discharge current slot?

        Only if there's enough charge in the battery to last until the first available always-buy slot

      To calculate that:  

        Get time of first always-buy slot: D

        If D is not current time:

          Get net power needed from now until D:  A

          Get power currently available in battery after 1 slot's worth of discharge: B

          If B > A then discharge slot

      But - only if A isn't negative.  If it's negative, then it means PV generation is in full swing
      so discharging the battery is not desirable.  The risk is the battery keeps getting discharged and
      not enought time to get it recharged again.  This is generally an issue when always buy slots
      are during solar production time (eg afternoon) rather than in the early hours.

      Note: if D is later than time of first production, then check that discharging won't leave
      battery empty too early

    */

    let positionNow = this.positionNow(false);

    this.logger.write('Should battery discharge during this slot?');
    this.logger.write('Position Now:');
    this.logger.write(positionNow);

    let noOfAlwaysBuySlots = +this.octopus.noOfAlwaysBuySlots;
    this.logger.write('No of always-buy slots: ' + noOfAlwaysBuySlots);
    this.logger.write('No of charge slots needed till cutoff: ' + positionNow.chargeSlotsNeeded);

    if (noOfAlwaysBuySlots > positionNow.chargeSlotsNeeded) {
      this.logger.write('Discharge possible: further analysis...');
      let auprice = positionNow.alwaysUsePrice;
      this.logger.write('always use price: ' + auprice);
      let now = this.date.now();
      this.octopus.sortSlots();
      let slots = this.octopus.cheapestSlotArray;
      let earliestSlotTime = 5000000000000;
      let timeText = '';
      for (let slot of slots) {
        if (slot.price <= auprice && +slot.timeIndex != now.slotTimeIndex && +slot.timeIndex < earliestSlotTime) {
          earliestSlotTime = +slot.timeIndex;
          timeText = slot.timeText;
        }
      }
      this.logger.write('Earliest alwaysUse slot = ' + earliestSlotTime + ': ' + timeText);
      if (positionNow.slot !== timeText) {
        this.logger.write('Enough battery power for discharge?');
        let then = this.date.at(earliestSlotTime);
        let override = false;
        if (now.dateIndex === then.dateIndex) override = true;
        this.logger.write('override (should be false if earliest slot is tomorrow): ' + override);

        let netPowerNeeded = this.netPowerBetween(positionNow.slot, timeText, override, true);
        this.logger.write('Net power needed from now until ' + timeText + ': ' + netPowerNeeded);
        //netPowerNeeded += positionNow.battery.powerAddedPerCharge;
        //let availablePower = positionNow.battery.availablePower;
        this.logger.write('Current battery level: ' + positionNow.battery.level);
        this.logger.write('Average percentage drop per discharge: ' + this.percentDecreasePerDischarge);
        let levelAfterDischarge = positionNow.battery.level - this.percentDecreasePerDischarge;
        this.logger.write('Level after discharge: ' + levelAfterDischarge);
        this.logger.write('Minimum level: ' + this.minimumLevel);
        if (levelAfterDischarge <= this.minimumLevel) {
          this.logger.write('Battery level too low for discharging');
          return false;
        }
        let availablePower = this.powerFromPercentage(levelAfterDischarge - this.minimumLevel);
        this.logger.write('Available in battery after a discharge: ' + availablePower);
        if (availablePower < 0) {
          this.logger.write('Battery level too low for discharging');
          return false;
        }
        if (netPowerNeeded < 0) {
          this.logger.write('PV surplus - ie negative net power needed.  Dont discharge');
          return false;
        }
        if (availablePower > netPowerNeeded) {

          // If the first Always Buy slot is after the first production turnaround time,
          //  then only discharge if it won't leave the battery prematurely empty before
          //  PV kicks in

          this.logger.write('Discharge possible, but check time of first production...');

          let firstPVTime = this.solcast.firstProductionTime;
          if (firstPVTime) {
            let firstPVTimeIndex = firstPVTime.timeIndex + this.solis.productionDelay;
            let firstPVTimeText = this.date.at(firstPVTimeIndex).timeText;
            let firstPVTimeToday = this.date.atTime(firstPVTimeText);
            this.logger.write('firstPVTimeToday: ' + firstPVTimeToday.timeIndex);
            this.logger.write('earliestSlotTime: ' + earliestSlotTime);
            if (earliestSlotTime > firstPVTimeToday.timeIndex) {
              this.logger.write('Earliest Always Buy slot is after time of first production...');

              if (now.hour >= 16 || now.timeIndex < firstPVTimeToday.timeIndex) {
                this.logger.write('Time now is after 4pm or before time of first production...');
                let todayOnly = true;
                if (now.hour > 16) todayOnly = false;
                this.logger.write('Get net power requirements from now to First Production time: ' + firstPVTimeText);
                let netPowerNeededTillFP = this.netPowerBetween(positionNow.slot, firstPVTimeText, override, true);
                this.logger.write('Net power needed from now until ' + firstPVTimeText + ': ' + netPowerNeededTillFP);
                this.logger.write('Available power in battery (after a discharge): ' + availablePower);
                if (availablePower < netPowerNeededTillFP) {
                  this.logger.write('Not enough surplus power to discharge without exhausting battery before first production');
                  return false;
                }
              }
            }
            else {
              this.logger.write('Earliest Always Buy Slot is before time of first production, so continue');
            }
          }
          else {
            this.logger.write('Unable to calculate first production time, so continue');
          }

          this.logger.write('Discharge current slot!');
          // set first production logic suppression
          this.suppressFirstProductionLogic();
          this.logger.write('First Production Logic suppression flag has been set');
          return true;
        }
        else {
          this.logger.write('Not enough surplus power to discharge');
          return false;
        }
      }
      else {
        this.logger.write('Earliest always use slot is current slot: dont discharge');
        return false;
      }
    }
    else {
      this.logger.write('No of always-buy slots does not exceed no of charge slots needed, so dont discharge');
      return false;
    }


    // old logic:

    //let solisNow = this.solis.dataNow;
    /*
    if (+solisNow.pvOutputNow > +solisNow.houseLoadNow) {
      this.logger.write('Currently generating more solar PV than house load, so dont attempt to discharge');
      return false;
    }
    */
    /*
    let d = this.date.now();
    let prevD = this.date.at(d.previousSlotTimeIndex);
    let previousSlotPower = this.solis.averagePowerBetween(prevD.timeText, d.slotTimeText);
    if (+previousSlotPower.pv > +previousSlotPower.load) {
      this.logger.write('Previous 30 minutes generated more solar PV than house load, so dont attempt to discharge');
      return false;
    }

    if (this.isDischargeControlFlagSet()) {
      this.logger.write('Manual Discharge control flag has been set');
      return true;
    }

    let noOfAlwaysBuySlots = +this.octopus.noOfAlwaysBuySlots;
    if (noOfAlwaysBuySlots === 0) {
      this.logger.write('No slots available under the always buy price, so dont attempt to discharge');
      return false;
    }

    this.logger.write('Number of always buy slots: ' + noOfAlwaysBuySlots);

    let noOfUnmatchedAlwaysBuySlots = this.octopus.noOfUnmatchedAlwaysBuySlots;
    if (noOfUnmatchedAlwaysBuySlots === 0) {
      this.logger.write('No unmatched always buy slots left');
      return false; 
    }
    this.logger.write('Number of unmatched always buy slots: ' + noOfUnmatchedAlwaysBuySlots);

    // calculate net power needed between now and earliest charging slot

    let powerNeeded = this.netPowerBetween(this.date.now().slotTimeText, '22:30');
    this.logger.write('Net power needed between now and 22:30: ' + powerNeeded.toFixed(2));

    let noOfSlotsNeeded = this.noOfSlotsNeeded(powerNeeded);
    if (typeof noOfSlotsNeeded === 'undefined') {
      this.logger.write('Unable to calculate battery level, probably due to comms issues');
      return false; 
    }
    console.log('noOfSlotsNeeded: ' + noOfSlotsNeeded);
    let earliestSlotTimeIndex = this.octopus.getEarliestSlotToUse(noOfSlotsNeeded);
    let earlyD = this.date.at(earliestSlotTimeIndex);
    this.logger.write('earliest charging slot is at ' + earlyD.timeText);
    let power = this.solis.averagePowerBetweenTimeIndices(d.timeIndex, earliestSlotTimeIndex);
    powerNeeded = +power.load;
    this.logger.write('Power needed from now until earliest charge slot: ' + powerNeeded.toFixed(2));

    // compare with power in battery

    let powerInBattery = this.availablePowerNow;
    if (typeof powerInBattery === 'undefined') {
      this.logger.write('Unable to calculate battery level, probably due to comms issues');
      this.logger.write('Dont discharge');
      return false;
    }
    this.logger.write('Available power in battery: ' + powerInBattery);

    if ((powerInBattery - powerNeeded) > 1) {
      let slot = this.octopus.firstUnmatchedAlwaysBuySlot;
      this.octopus.matchAlwaysBuySlot(slot.dateIndex, slot.timeIndex);
      console.log('matching slot:');
      console.log(slot);
      this.logger.write('enough surplus power to discharge');
      this.logger.write('Matching always use slot: ');
      this.logger.write(JSON.stringify(slot));
      return true;
    }
    this.logger.write('Insufficient surplus power to allow discharge');
    return false;
    */
  }

  positionNow(log, toTimeText, todayOnly, ignorePV) {
    if (typeof log === 'undefined') log = true;
    todayOnly = todayOnly || false;
    toTimeText = toTimeText || this.calculationCutoffTime; //'22:30';
    let d = this.date.now();
    let fromTimeText = d.slotTimeText;
    let slotEndTimeText = this.date.at(d.slotEndTimeIndex).timeText;
    let isPeakTime = false;
    if (d.hour > 15 && d.hour < 19) isPeakTime = true;
    let solis;

    if (!todayOnly && this.octopus.tomorrowsTariffsAvailable) {
      let power1 = this.solis.averagePowerBetween(fromTimeText, '23:50', log);
      let power2 = this.solis.averagePowerBetween('00:01', toTimeText, log);
      solis = {
        load: +power1.load + +power2.load,
        pv: +power1.pv + +power2.pv
      };
    }
    else {
      solis = this.solis.averagePowerBetween(fromTimeText, toTimeText, log);
    }
    solis.load = +solis.load + this.axle.powerAdjustment;
    if (ignorePV) solis.pv = 0;
    let pv = solis.pv;
    let solcast = {
      enabled: false
    };
    if (this.solcast.isEnabled) {
      let spv = +this.solcast.expectedPowerBetween(fromTimeText, toTimeText, todayOnly, false, log);
      let adjustment = +this.solcast.adjustment;
      let adjusted = spv + ((spv * adjustment) / 100);
      pv = adjusted;
      solcast = {
        enabled: true,
        prediction: spv,
        adjustment: adjustment,
        adjustedPrediction: adjusted
      };
      if (ignorePV) {
        solcast.prediction = 0;
        solcast.adjustedPrediction = 0;
      }
    }
    if (ignorePV) pv = 0;
    let batteryLevel = this.levelNow;
    let batteryPower = this.availablePowerNow;

    let noOfSlotsToFillBattery = 0;
    if (batteryLevel && batteryLevel < 100) {
      let powerNeededToFillBattery = this.powerFromPercentage(100 - batteryLevel);
      noOfSlotsToFillBattery = this.noOfSlotsToChargeBy(powerNeededToFillBattery, false);
    }
    let deficit;
    if (typeof batteryPower === 'undefined') {
      deficit = 0;
    }
    else {
      deficit = solis.load - batteryPower - pv;
    }
    let chargeSlots = 0;
    if (deficit > 0) chargeSlots = this.noOfSlotsToChargeBy(deficit, false);
    let increasePerCharge = this.percentIncreasePerCharge;

    let untilTomorrow = this.octopus.tomorrowsTariffsAvailable;
    if (todayOnly) untilTomorrow = false;

    let data = {
      slot: fromTimeText,
      slotEnd: slotEndTimeText,
      untilTomorrow: untilTomorrow,
      calculationCutoffTime: this.calculationCutoffTime,
      movingAveragePeriod: this.agility.movingAveragePeriod,
      solis: solis,
      solcast: solcast,
      battery: {
        level: batteryLevel,
        chargeLimit: this.chargeLimit,
        minimumLevel: this.minimumLevel,
        availablePower: batteryPower,
        noOfSlotsToFillBattery: noOfSlotsToFillBattery,
        increasePerCharge: increasePerCharge,
        powerAddedPerCharge: this.powerFromPercentage(increasePerCharge)
      },
      octopus: {
        priceNow: +this.octopus.priceNow
      },
      deficit: deficit,
      chargeSlotsNeeded: chargeSlots,
      alwaysUsePrice: this.agility.alwaysUsePrice,
      todaysAlwaysUsePrice: this.agility.todaysAlwaysUsePrice,
      isPeakTime: isPeakTime,
      chargingDecision: {
        charge: false,
        reason: ''
      }
    };

    if (data.isPeakTime) {
      data.chargingDecision.charge = false;
      data.chargingDecision.reason = 'Dont charge during 16:00 to 19:00 peak';
      return data;
    }
    if (typeof data.battery.level === 'undefined') {
      data.chargingDecision.charge = false;
      data.chargingDecision.reason = 'Unable to calculate battery level, probably due to comms issues';
      return data;
    }
    /*
    if (data.octopus.priceNow <= 0) {
      data.chargingDecision.charge = 'charge';
      data.chargingDecision.reason = 'Slot price of ' + data.octopus.priceNow + ' is at or below zero';
      return data;
    }
    */
    if (data.octopus.priceNow <= data.alwaysUsePrice) {
      data.chargingDecision.charge = 'charge';
      data.chargingDecision.reason = 'Slot price of ' + data.octopus.priceNow + ' is at or below Always Use price of ' + data.alwaysUsePrice;
      return data;
    }
    if (this.agility.isTodaysAlwaysUsePriceSet && data.octopus.priceNow <= this.agility.todaysAlwaysUsePrice) {
      data.chargingDecision.charge = 'charge';
      data.chargingDecision.reason = 'Slot price of ' + data.octopus.priceNow + ' is at or below Todays Always Use price of ' + this.agility.todaysAlwaysUsePrice;
      return data;
    }
    if (data.battery.chargeLimit < 100 && data.battery.level >= data.battery.chargeLimit) {
      data.chargingDecision.charge = false;
      data.chargingDecision.reason = 'Battery level is already at its charge limit of ' + data.battery.chargeLimit;
      return data;
    }
    if (typeof data.chargeSlotsNeeded === 'undefined') {
      data.chargingDecision.charge = false;
      data.chargingDecision.reason = 'Unable to calculate battery level, probably due to comms issues';
      return data;
    }
    if (data.chargeSlotsNeeded === 0) {
      data.chargingDecision.charge = false;
      data.chargingDecision.reason = 'No charge slots needed to meet power needs';
      return data;
    }
    return data;
  }

  availableSlotsByPrice(log) {
    let positionNow = this.positionNow(log);
    console.log(positionNow);
    let to = '19:30';
    if (this.octopus.customTariffEnabled) {
      to = positionNow.calculationCutoffTime;
    }
    console.log('Sorting slots until ' + to);
    this.octopus.sortSlots(to);
    let slots = this.octopus.cheapestSlotArray;

    return {
      slots: slots,
      positionNow: positionNow
    };
  }

  peakExport() {

    let now = this.date.now();
    let peakSlotNode = this.operation.$(['peakSlots', now.slotTimeText]);
    if (peakSlotNode.exists && peakSlotNode.value === false) {
      return {status: now.slotTimeText + ' has been disabled as a peak time slot'};
    }

    let chargeData = this.latestChargeDecision;
    if (chargeData) {
      let powerAddedPerCharge = +chargeData.battery.powerAddedPerCharge;
      let surplus = -chargeData.deficit;
      this.logger.write('Peak Export check');
      this.logger.write('Current surplus: ' + surplus);
      this.logger.write('Power Added Per Charge: ' + powerAddedPerCharge);
      if (surplus > powerAddedPerCharge) {
        this.agility.addTask('inverterExport');
        return {status: 'Sufficient surplus energy to allow discharge during this slot'};
      }
      else {
        return {status: 'Insufficient surplus energy to allow any export'};
      }
    }
    else {
      return {status: 'Unable to find a charge decision history record for current time slot'};
    }
  }

  resetPeakHours() {
    this.operation.$('peakSlots').delete();
    return {status: 'Peak hours reset to 16:00-19:00'};
  }

  shouldUseSlotToCharge(positionNow, slots, log, setAlwaysUsePrice) {
    if (typeof setAlwaysUsePrice === 'undefined') setAlwaysUsePrice = true;
    if (this.octopus.customTariffEnabled) setAlwaysUsePrice = false;
    let remainingPowerNeeded = positionNow.deficit;

    // after 6:30pm, provided tomorrows tariffs are available,
    // set today's always use price based on slots needed to fill battery from current level
    let now = this.date.now().timeIndex;
    let cutoff = this.date.atTime('20:30').timeIndex;
    //if (positionNow.untilTomorrow && now > at7 && !this.agility.isTodaysAlwaysUsePriceSet) {
    if (setAlwaysUsePrice && positionNow.untilTomorrow && now < cutoff && !this.agility.chargingHasStarted) {
      let noOfSlots = positionNow.battery.noOfSlotsToFillBattery;
      if (positionNow.chargeSlotsNeeded < noOfSlots) noOfSlots = positionNow.chargeSlotsNeeded;
      if (noOfSlots > 0) {
        let index = noOfSlots - 1;
        this.agility.todaysAlwaysUsePrice = slots[index].price;
      }
      else {
        // in case things have changed and no slots needed any more
        this.agility.deleteTodaysAlwaysUsePrice();
      }
    }

    if (this.agility.isTodaysAlwaysUsePriceSet && positionNow.octopus.priceNow <= this.agility.todaysAlwaysUsePrice) {
      positionNow.chargingDecision.charge = 'charge';
      positionNow.chargingDecision.reason = 'Slot price of ' + positionNow.octopus.priceNow + ' is at or below Todays Always Use price of ' + this.agility.todaysAlwaysUsePrice;
      return positionNow;
    }

    let count = 0;
    for (let slot of slots) {
      console.log(slot);
      count++;
      if (log) this.logger.write('slot ' + count + ': ' + slot.timeText + ': price: ' + slot.price);

      // if battery level is at or below the minimum, nothing to do

      console.log(this.agility.isTodaysAlwaysUsePriceSet);
      console.log(slot.price);
      console.log(this.agility.todaysAlwaysUsePrice);

      if (count > positionNow.battery.noOfSlotsToFillBattery && positionNow.battery.level <= positionNow.battery.minimumLevel) {
        positionNow.chargingDecision.charge = false;
        positionNow.chargingDecision.reason = 'Not a priority slot. Battery is at or below its minumum level, so no action (will use grid power)';
        break;
      }

      if (count === 1 && positionNow.chargeSlotsNeeded === 1 && positionNow.slot === slot.timeText) {
        // use this slot if it's the first and only 1 charge slot needed
        positionNow.chargingDecision.charge = 'charge';
        positionNow.chargingDecision.reason = 'Only 1 slot needed and this current one is the cheapest available, so use it';
        break;
      }

      if (count <= positionNow.battery.noOfSlotsToFillBattery) {
        remainingPowerNeeded = remainingPowerNeeded - positionNow.battery.powerAddedPerCharge;
        if (log) this.logger.write('remainining power needed after battery charge: ' + remainingPowerNeeded.toFixed(2));
      }
      else {
        // grid only slot
        let slotEndTimeText = positionNow.slotEnd;
        let netPower;
        if (slot.timeText === '23:30') {
          netPower = 0;
        }
        else {
          let slotEndTimeIndex = this.date.at(slot.timeIndex).slotEndTimeIndex;
          let slotEndText = this.date.at(slotEndTimeIndex).timeText;
          netPower = this.netPowerBetween(slot.timeText, slotEndText, true, false);
          console.log('netPower: ' + slot.timeText + ' to ' + slotEndText + ' = ' + netPower);
        }
        if (log) this.logger.write('Net power until slot end at ' + slot.timeText + ': ' + netPower.toFixed(2));
        remainingPowerNeeded = remainingPowerNeeded - netPower;
        if (log) this.logger.write('remainining power needed: ' + remainingPowerNeeded.toFixed(2));
        console.log('remaining power: ' + remainingPowerNeeded);
      }

      if (positionNow.slot === slot.timeText) {

        // slot is the current one,so:

        if (count <= positionNow.battery.noOfSlotsToFillBattery) {
          positionNow.chargingDecision.charge = 'charge';
          positionNow.chargingDecision.reason = 'Priority slot. Matches current time slot. Use it to charge battery, even if generating a surplus from PV';
          break;
        }
        if (log) this.logger.write('Slot is not to be used to charge battery');

        // use this slot for grid only power

        positionNow.chargingDecision.charge = 'gridonly';
        positionNow.chargingDecision.reason = 'Non-priority slot. Matches current time slot. Use grid power only';
        break;
      }

      if (remainingPowerNeeded <= 0) {
        positionNow.chargingDecision.charge = false;
        positionNow.chargingDecision.reason = 'Power deficit would be accounted for by previous cheaper slots: take no action';
        break;
      }

      if (count === positionNow.chargeSlotsNeeded) {
        if (log) this.logger.write('Reached limit of ' + positionNow.chargeSlotsNeeded + ' slots');
        if (log) this.logger.write('Let this slot draw power from battery');
        positionNow.chargingDecision.charge = false;
        positionNow.chargingDecision.reason = 'Reached limit of ' + positionNow.chargeSlotsNeeded + ' slots. Current slot isnt one to use. Dont charge';
        break;
      }    

    }
    return positionNow;
  }

  cleardownChargeHistory() {
    let count = 0;
    let _this = this;
    this.chargeHistory.forEachChildNode({direction: 'reverse'}, function(timeNode) {
      count++;
      if (count > _this.noOfChargeRecordsToKeep) {
        timeNode.delete();
      }
    });
    this.logger.write('Battery charge history cleared down to most recent ' + this.noOfChargeRecordsToKeep + ' records');

    count = 0;
    this.dischargeHistory.forEachChildNode({direction: 'reverse'}, function(timeNode) {
      count++;
      if (count > _this.noOfChargeRecordsToKeep) {
        timeNode.delete();
      }
    });
    this.logger.write('Battery discharge history cleared down to most recent ' + this.noOfChargeRecordsToKeep + ' records');

    let noOfDaysToKeep = this.agility.movingAveragePeriod;
    count = 0;
    this.chargeDecisionHistory.forEachChildNode({direction: 'reverse'}, function(dateNode) {
      count++;
      if (count > noOfDaysToKeep) {
        dateNode.delete();
      }
    });
    this.logger.write('Charge Decision History cleared down to most recent ' + noOfDaysToKeep + ' days');
  }

};

export {Battery};


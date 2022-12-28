# FJNU-ics-Enhanced

Login your account, fetch schedule, generate ics file all in one page!

## Installation

Make sure you have NodeJS installed.

```sh
git clone https://github.com/MoveToEx/FJNU-ics-Enhanced
cd FJNU-ics-Enhanced
npm install
npm start
```

Visit `http://server_address:3000`.  

## Usage

Since FJNU system has no way of knowing the actual semester progress, this program needs a date as the starting date of the semester. It requires you to input the date of the first Monday of the semester.  

The generation of ics file is dependent on this date, so make sure it is correct.  

## Terms

As FJNU does not allow cross-domain requests, all the requests are done by the server.  
This means the password is transported to the server, and then to FJNU server.  

We promise we will not store any user information or use them in any places apart from fetching class schedule and converting it to iCal format.  
Please make sure you have a secure Internet connection when visiting this page.  

This program is not fully reliable, as we're unsure whether or not FJNU schedule has any features we have not implemented yet.

We do not take responsibilities for any outcomes, including correct ics, faulty ics, or data breaches caused by cyber hijacks.

## Thrid-party libraries

[MDUI](https://mdui.org/)  
[FontAwesome](https://fontawesome.dashgame.com/)  
[jQuery](https://jquery.com/)